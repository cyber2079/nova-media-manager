import { useEffect, useCallback, useState, useRef } from "react";
import { useQuickLaunchStore } from "@/stores/quickLaunchStore";
import { Play, Plus } from "lucide-react";
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
  const checkTimer = useRef<ReturnType<typeof setInterval>>();

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

  const handleRightClick = useCallback(async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    await remove(id);
  }, [remove]);

  const handleLaunch = useCallback(async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await launch(path);
    // Re-check after a short delay to let the process start
    setTimeout(doCheck, 1500);
  }, [launch, doCheck]);

  const handleAdd = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "可执行文件", extensions: ["exe", "lnk", "bat", "cmd", "com"] }],
      });
      if (selected) await add(selected as string);
    } catch {}
  }, [add]);

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
              onClick={(e) => handleLaunch(e, item.programPath)}
              onContextMenu={(e) => handleRightClick(e, item.id)}
              onMouseEnter={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
                setTooltip(item.name);
              }}
              onMouseLeave={() => setTooltip(null)}
              className="flex items-center justify-center rounded-md w-9 h-9
                text-gray-400 hover:bg-surface-lighter hover:text-white hover:scale-110 hover:shadow-md transition-all duration-200 active:scale-90
                border border-transparent hover:border-primary/30 overflow-hidden"
              title={`${item.name} — ${t("quicklaunch.right_click_delete")}`}
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
        onClick={handleAdd}
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

      {tooltip && (
        <div
          className="fixed z-[100] pointer-events-none px-2 py-1 rounded text-[11px]
            bg-surface-lighter border border-primary text-white shadow-lg"
          style={{ left: tooltipPos.x, top: tooltipPos.y, transform: "translate(-50%, -100%)" }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
