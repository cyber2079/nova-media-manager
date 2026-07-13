import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn, formatFileSize } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Folder, File, HardDrive, X, FolderOpen,
  RefreshCw, Trash2, Copy, Scissors, ClipboardPaste, Pencil, FolderPlus,
  CheckSquare, Square,
} from "lucide-react";

// region Types
interface DriveInfo { name: string; path: string; }
interface DirEntry { name: string; path: string; isDir: boolean; size: number; modified: string; }

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try { const { invoke: tauriInvoke } = await import("@tauri-apps/api/core"); return await tauriInvoke(cmd, args) as T; }
  catch { return null; }
}
// endregion

export default function FileExplorer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // region State
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [newFolderInput, setNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [msg, setMsg] = useState("");
  const [clipCount, setClipCount] = useState(0);
  const [pinned, setPinned] = useState<{ name: string; path: string }[]>([]);
  // endregion

  // region Load drives + pinned folders on open
  useEffect(() => { if (!open) return; (async () => {
    const d = await invoke<DriveInfo[]>("list_drives");
    const pf = await invoke<{ name: string; path: string }[]>("list_pinned_folders");
    if (d) { setDrives(d); if (d.length > 0 && !currentPath) navigateTo(d[0].path); }
    if (pf) setPinned(pf);
  })(); }, [open]);
  // endregion

  // region Navigation
  const navigateTo = useCallback(async (path: string) => {
    const result = await invoke<DirEntry[]>("list_dir", { path });
    if (result) {
      setEntries(result); setCurrentPath(path); setSelected(new Set());
      setHistory((prev) => { const h = prev.slice(0, historyIdx + 1); h.push(path); return h; });
      setHistoryIdx((i) => i + 1);
    }
  }, [historyIdx]);

  const refresh = useCallback(async () => { if (currentPath) { const r = await invoke<DirEntry[]>("list_dir", { path: currentPath }); if (r) { setEntries(r); setSelected(new Set()); } } }, [currentPath]);

  const goBack = useCallback(() => { if (historyIdx > 0) { const p = history[historyIdx - 1]; setHistoryIdx(historyIdx - 1); navigateTo(p); } }, [history, historyIdx, navigateTo]);
  const goForward = useCallback(() => { if (historyIdx < history.length - 1) { const p = history[historyIdx + 1]; setHistoryIdx(historyIdx + 1); navigateTo(p); } }, [history, historyIdx, navigateTo]);
  const goUp = useCallback(async () => { const parent = currentPath.split("\\").slice(0, -1).join("\\"); if (parent.length >= 2) navigateTo(parent); }, [currentPath, navigateTo]);
  // endregion

  // region Selection
  const toggleSelect = (path: string, shiftKey = false) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(entries.map((e) => e.path)));
  const clearSelection = () => setSelected(new Set());
  const selectedList = () => Array.from(selected);
  // endregion

  // region Operations
  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 2500); };

  const handleDelete = async () => {
    const list = selectedList(); if (list.length === 0) { flash("请先选择文件"); return; }
    const text = await invoke<string>("delete_items", { paths: list });
    if (text) flash(text); refresh();
  };

  const handleCopy = async () => {
    const list = selectedList(); if (list.length === 0) { flash("请先选择文件"); return; }
    await invoke("copy_items", { paths: list }); setClipCount(list.length); flash(`已复制 ${list.length} 项`);
  };

  const handleCut = async () => {
    const list = selectedList(); if (list.length === 0) { flash("请先选择文件"); return; }
    await invoke("cut_items", { paths: list }); setClipCount(list.length); flash(`已剪切 ${list.length} 项`);
  };

  const handlePaste = async () => {
    const text = await invoke<string>("paste_items", { destDir: currentPath });
    if (text) flash(text); setClipCount(0); refresh();
  };

  const handleRename = async () => {
    if (!renaming || !renameName.trim()) { setRenaming(null); return; }
    const text = await invoke<string>("rename_item", { path: renaming, newName: renameName.trim() });
    if (text) { flash("已重命名"); refresh(); }
    setRenaming(null);
  };

  const handleProperties = async () => {
    const list = selectedList(); const target = list.length === 1 ? list[0] : currentPath;
    await invoke("show_properties", { path: target });
  };

  const handleNewFolder = async () => {
    if (!newFolderName.trim()) { setNewFolderInput(false); return; }
    await invoke("create_folder", { parent: currentPath, name: newFolderName.trim() });
    setNewFolderInput(false); setNewFolderName(""); refresh();
  };
  // endregion

  // region Open item
  const openItem = useCallback(async (entry: DirEntry) => {
    if (entry.isDir) { navigateTo(entry.path); } else {
      try { const { open: shellOpen } = await import("@tauri-apps/plugin-shell"); await shellOpen(entry.path); } catch {}
    }
  }, [navigateTo]);
  // endregion

  // region Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Delete" || e.key === "Del") handleDelete();
      if (e.ctrlKey && e.key === "c") handleCopy();
      if (e.ctrlKey && e.key === "x") handleCut();
      if (e.ctrlKey && e.key === "v") handlePaste();
      if (e.ctrlKey && e.key === "a") { e.preventDefault(); selectAll(); }
      if (e.key === "F5") { e.preventDefault(); refresh(); }
      if (e.key === "F2" && selectedList().length === 1) { const p = selectedList()[0]; setRenaming(p); setRenameName(entries.find((e) => e.path === p)?.name || ""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, entries, currentPath]);
  // endregion

  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx < history.length - 1;
  const hasSelection = selected.size > 0;
  const singleSelected = selected.size === 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="overflow-hidden flex flex-col p-0 gap-0 [&>button]:top-3 focus-visible:outline-none" style={{ width: "960px", height: "680px", maxWidth: "95vw", maxHeight: "95vh" }}>
        <DialogTitle className="sr-only">File Explorer</DialogTitle>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-primary shrink-0 flex-wrap"
          style={{ background: "var(--color-surface)" }}>
          <button onClick={goBack} disabled={!canGoBack} className="text-gray-400 hover:text-white disabled:opacity-25 p-1.5" title="后退"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={goForward} disabled={!canGoForward} className="text-gray-400 hover:text-white disabled:opacity-25 p-1.5" title="前进"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={goUp} className="text-gray-400 hover:text-white p-1.5" title="上级目录"><FolderOpen className="h-4 w-4" /></button>
          <div className="w-px h-5 bg-surface-lighter mx-0.5" />
          <button onClick={refresh} className="text-gray-400 hover:text-white p-1.5" title="刷新 F5"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={() => { setNewFolderInput(true); setNewFolderName("新建文件夹"); }} className="text-gray-400 hover:text-white p-1.5" title="新建文件夹"><FolderPlus className="h-4 w-4" /></button>
          <div className="w-px h-5 bg-surface-lighter mx-0.5" />
          <button onClick={handleCopy} disabled={!hasSelection} className="text-gray-400 hover:text-white disabled:opacity-25 p-1.5" title="复制 Ctrl+C"><Copy className="h-4 w-4" /></button>
          <button onClick={handleCut} disabled={!hasSelection} className="text-gray-400 hover:text-white disabled:opacity-25 p-1.5" title="剪切 Ctrl+X"><Scissors className="h-4 w-4" /></button>
          <button onClick={handlePaste} disabled={clipCount === 0} className="text-gray-400 hover:text-white disabled:opacity-25 p-1.5" title="粘贴 Ctrl+V">{clipCount > 0 ? <><ClipboardPaste className="h-4 w-4 inline" /><span className="text-[10px] ml-1">{clipCount}</span></> : <ClipboardPaste className="h-4 w-4" />}</button>
          <div className="w-px h-5 bg-surface-lighter mx-0.5" />
          <button onClick={handleDelete} disabled={!hasSelection} className="text-gray-400 hover:text-red-400 disabled:opacity-25 p-1.5" title="删除 Del"><Trash2 className="h-4 w-4" /></button>
          <div className="flex-1" />
          {/* Path display — leave room for Dialog close button */}
          <span className="text-[10px] text-gray-600 truncate max-w-[240px] mr-8">{currentPath}</span>
        </div>

        {/* New folder inline input */}
        {newFolderInput && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20">
            <FolderPlus className="h-3.5 w-3.5 text-primary-light" />
            <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleNewFolder(); if (e.key === "Escape") setNewFolderInput(false); }}
              onBlur={handleNewFolder}
              className="flex-1 bg-transparent text-xs text-white outline-none border-b border-primary-light/50" />
          </div>
        )}

        {/* Toast message */}
        {msg && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-xs text-white px-4 py-2 rounded-lg pointer-events-none">
            {msg}
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar: pinned + drives */}
          <div className="w-40 shrink-0 border-r border-primary py-2 px-2 space-y-0.5 overflow-y-auto"
            style={{ background: "var(--color-surface-light)" }}>
            {/* Pinned folders */}
            {pinned.length > 0 && (
              <>
                <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 py-1">常用</div>
                {pinned.map((p) => (
                  <button key={p.path} onClick={() => navigateTo(p.path)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate text-gray-400 hover:bg-surface-lighter">
                    <Folder className="h-3 w-3 inline mr-1.5 text-yellow-500/70" />{p.name}
                  </button>
                ))}
                <div className="h-px bg-surface-lighter mx-2 my-1" />
              </>
            )}
            {/* Drives */}
            <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 py-1">磁盘</div>
            {drives.map((d) => (
              <button key={d.path} onClick={() => { navigateTo(d.path); }}
                className={cn("w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate",
                  currentPath.startsWith(d.path) ? "bg-primary/15 text-primary-light" : "text-gray-400 hover:bg-surface-lighter")}>
                <HardDrive className="h-3 w-3 inline mr-1.5" />{d.name}
              </button>
            ))}
          </div>

          {/* File list with header */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-1.5 border-b border-primary text-[10px] text-gray-600 select-none shrink-0">
              <button onClick={() => hasSelection ? clearSelection() : selectAll()} className="text-gray-500 hover:text-white p-0.5" title="全选/取消">
                {hasSelection ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              </button>
              <span className="text-xs text-gray-500">{selected.size > 0 ? `已选 ${selected.size} 项` : "名称"}</span>
              <span className="flex-1" />
              <span className="w-24 text-right">大小</span>
              <span className="w-28 text-right hidden sm:block">修改时间</span>
              <span className="w-6" />
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto py-0.5">
              {entries.map((e) => {
                const sel = selected.has(e.path);
                const isRenaming = renaming === e.path;
                return (
                  <div key={e.path}
                    onClick={(ev) => {
                      if (renaming) return;
                      if (ev.ctrlKey || ev.metaKey) { toggleSelect(e.path); return; }
                      if (ev.shiftKey) { toggleSelect(e.path, true); return; }
                      if (selected.size > 0) { toggleSelect(e.path); return; }
                      if (isRenaming) return;
                      openItem(e);
                    }}
                    onDoubleClick={() => { if (!isRenaming) openItem(e); }}
                    onContextMenu={(ev) => {
                      ev.preventDefault();
                      if (!sel) { setSelected(new Set([e.path])); }
                    }}
                    className={cn("flex items-center gap-3 px-4 py-1.5 hover:bg-surface-lighter/50 transition-colors cursor-pointer group text-sm",
                      sel && "bg-primary/10")}
                  >
                    {/* Checkbox on hover or selection */}
                    <div className={cn("w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                      (sel || "opacity-0 group-hover:opacity-100"),
                      sel ? "bg-primary border-primary text-white" : "border-primary")}
                      onClick={(ev) => { ev.stopPropagation(); toggleSelect(e.path); }}>
                      {sel && <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
                    </div>

                    {e.isDir ? <Folder className="h-4 w-4 text-yellow-500/70 shrink-0" /> : <File className="h-4 w-4 text-gray-500 shrink-0" />}

                    {/* Name / Inline rename */}
                    <span className="flex-1 truncate min-w-0">
                      {isRenaming ? (
                        <input autoFocus value={renameName} onChange={(e) => setRenameName(e.target.value)}
                          onKeyDown={(ev) => { if (ev.key === "Enter") handleRename(); if (ev.key === "Escape") setRenaming(null); }}
                          onBlur={handleRename}
                          className="bg-surface-light text-xs text-white outline-none border-b border-primary-light w-full"
                          onClick={(ev) => ev.stopPropagation()} />
                      ) : (
                        <span className="text-gray-200">{e.name}</span>
                      )}
                    </span>
                    <span className="text-[11px] text-gray-600 shrink-0 w-24 text-right">{e.isDir ? "" : formatFileSize(e.size)}</span>
                    <span className="text-[10px] text-gray-600 shrink-0 w-28 text-right hidden sm:block">{e.modified}</span>

                    {/* Row action buttons */}
                    {!isRenaming && (
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 w-6 justify-end">
                        <button onClick={(ev) => { ev.stopPropagation(); setRenaming(e.path); setRenameName(e.name); }}
                          className="text-gray-600 hover:text-primary-light p-0.5" title="重命名"><Pencil className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer status bar */}
        <div className="px-4 py-1.5 border-t border-primary text-[10px] text-gray-600 shrink-0 flex items-center justify-between">
          <span>{entries.length} 个项目{selected.size > 0 ? ` | 已选 ${selected.size} 项` : ""}</span>
          <span className="text-gray-700">
            Del删除 | Ctrl+C复制 | Ctrl+X剪切 | Ctrl+V粘贴 | F2重命名 | F5刷新
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
