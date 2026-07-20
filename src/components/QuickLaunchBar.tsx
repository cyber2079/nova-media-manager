import { useEffect, useCallback, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuickLaunchStore, type QuickLaunchItem } from "@/stores/quickLaunchStore";
import { Play, Plus, Trash2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";

const iconCache = new Map<string, string>();

async function getIcon(path: string): Promise<string | null> {
  if (iconCache.has(path)) return iconCache.get(path)!;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const dataUrl: string = await invoke("extract_exe_icon", { path });
    if (dataUrl) { iconCache.set(path, dataUrl); return dataUrl; }
  } catch {}
  iconCache.set(path, "");
  return null;
}

export default function QuickLaunchBar() {
  const { t } = useTranslation();
  const { items, load, add, remove, launch } = useQuickLaunchStore();
  const { theme } = useThemeStore();
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const checkTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<{ item: QuickLaunchItem; x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const item of items) {
        if (cancelled) break;
        const dataUrl = await getIcon(item.programPath);
        if (cancelled) break;
        if (dataUrl) map[item.id] = dataUrl;
      }
      if (!cancelled) setIcons(map);
    })();
    return () => { cancelled = true; };
  }, [items]);

  // Batch-check running status every 5 seconds (single invoke call)
  useEffect(() => {
    if (items.length === 0) return;

    const poll = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const paths = items.map((i) => i.programPath);
        const results = await invoke("check_programs_running", { programPaths: paths }) as boolean[];
        const running = new Set<string>();
        items.forEach((item, i) => {
          if (results[i]) running.add(item.id);
        });
        setRunningIds(running);
      } catch {}
    };

    poll();
    checkTimer.current = setInterval(poll, 5000);
    return () => clearInterval(checkTimer.current);
  }, [items]);

  // Immediately re-check after launch
  const doCheck = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const paths = items.map((i) => i.programPath);
      const results = await invoke("check_programs_running", { programPaths: paths }) as boolean[];
      const running = new Set<string>();
      items.forEach((item, i) => {
        if (results[i]) running.add(item.id);
      });
      setRunningIds(running);
    } catch {}
  }, [items]);

  const handleRightClick = useCallback((e: React.MouseEvent, item: QuickLaunchItem) => {
    e.preventDefault();
    setContextMenu({ item, x: e.clientX, y: e.clientY });
  }, []);

  const handleEditArgs = useCallback(() => {
    if (!contextMenu) return;
    setAddPath(contextMenu.item.programPath);
    setAddArgs(contextMenu.item.args || "");
    setEditingId(contextMenu.item.id);
    setAdding(true);
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [contextMenu]);

  const contextRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [contextMenu]);

  const handleLaunch = useCallback(async (e: React.MouseEvent, item: QuickLaunchItem) => {
    e.stopPropagation();
    await launch(item.programPath, item.args || "");
    // Re-check after a short delay to let the process start
    setTimeout(doCheck, 1500);
  }, [launch, doCheck]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [addPath, setAddPath] = useState("");
  const [addArgs, setAddArgs] = useState("");

  const triggerAdd = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "可执行文件", extensions: ["exe", "lnk", "bat", "cmd", "com"] }],
      });
      if (selected) {
        setAddPath(selected as string);
        setAddArgs("");
        setEditingId(null);
        setAdding(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {}
  }, []);

  const confirmAdd = useCallback(async () => {
    if (!addPath) { setAdding(false); setEditingId(null); return; }
    if (editingId) {
      // Edit mode: remove old item and re-add with new args
      await remove(editingId);
    }
    await add(addPath, addArgs);
    setAdding(false); setAddPath(""); setAddArgs(""); setEditingId(null);
  }, [addPath, addArgs, add, editingId, remove]);

  // Theme-aware running underline color
  const runningDotColor = (() => {
    if (theme === "ice-girl") return "#87ceeb";
    return "var(--color-primary-light)";
  })();

  return (
    <div className="flex items-center gap-3.5">
      {items.map((item) => {
        const isRunning = runningIds.has(item.id);
        return (
          <div key={item.id} className="relative">
            <button
              onClick={(e) => handleLaunch(e, item)}
              onContextMenu={(e) => handleRightClick(e, item)}
              onMouseEnter={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
                setTooltip(item.name);
              }}
              onMouseLeave={() => setTooltip(null)}
              className="flex items-center justify-center rounded-md w-9 h-9
                text-gray-400 hover:bg-surface-lighter hover:text-white hover:scale-110 hover:shadow-md transition-all duration-200 active:scale-90
                border border-transparent hover:border-primary/30 overflow-hidden"
              title={item.name}
            >
              {icons[item.id] ? (
                <img src={icons[item.id]} alt={item.name} className="w-6 h-6 object-contain" style={{ imageRendering: "auto" }} />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
            {/* Running indicator: short low-saturation underline beneath the icon */}
            {isRunning && (
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded-full"
                style={{
                  bottom: -3,
                  width: 18,
                  height: 2,
                  backgroundColor: runningDotColor,
                  opacity: 0.35,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Add button — pulse ring */}
      <button
        onClick={triggerAdd}
        className="ql-add-btn flex items-center justify-center h-8 w-8 rounded-full
          text-gray-600 hover:text-primary-light
          transition-all duration-300 active:scale-90"
        title={t("quicklaunch.add")}
        style={{
          background: "transparent",
          boxShadow: "none",
        }}
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {/* Args input overlay when adding a program */}
      {adding && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => { setAdding(false); setEditingId(null); }}>
          <div className="rounded-2xl border border-primary/30 p-5 max-w-md w-full mx-4 shadow-2xl bg-surface-light"
            onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white mb-1">{editingId ? t("quicklaunch.edit_title") : t("quicklaunch.add_title")}</p>
            <p className="text-[10px] text-gray-500 break-all mb-4">{addPath}</p>
            <input
              ref={inputRef}
              type="text"
              value={addArgs}
              onChange={(e) => setAddArgs(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmAdd(); if (e.key === "Escape") { setAdding(false); setEditingId(null); } }}
              placeholder={t("quicklaunch.args_placeholder")}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-surface-dark text-sm text-white placeholder-gray-500 outline-none focus:border-primary-light mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAdding(false); setEditingId(null); }} className="px-4 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors">{t("settings.cancel")}</button>
              <button onClick={confirmAdd} className="px-4 py-1.5 rounded-lg text-xs bg-primary/20 text-primary-light hover:bg-primary/30 transition-colors font-medium">{t("quicklaunch.confirm_add")}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {tooltip && (
        <div
          className="fixed z-[100] pointer-events-none px-2 py-1 rounded text-[11px]
            bg-surface-lighter border border-primary text-white shadow-lg"
          style={{ left: tooltipPos.x, top: tooltipPos.y, transform: "translate(-50%, -100%)" }}
        >
          {tooltip}
        </div>
      )}

      {/* Right-click context menu — edit args or remove */}
      {contextMenu && createPortal(
        <div ref={contextRef}
          className="fixed z-[130] min-w-[120px] rounded-lg border border-white/10 bg-surface-light/98 backdrop-blur-md shadow-2xl py-1"
          style={{ left: contextMenu.x, bottom: `calc(100vh - ${contextMenu.y}px)` }}>
          <button
            onClick={handleEditArgs}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors">
            <Pencil className="h-3 w-3" />{t("quicklaunch.edit")}
          </button>
          <button
            onClick={() => { remove(contextMenu.item.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 className="h-3 w-3" />{t("quicklaunch.remove")}
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
