import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useImageStore } from "@/stores/imageStore";
import ImageCard from "@/components/ImageCard";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/SafeImage";
import TagFilterBar from "@/components/TagFilterBar";
import TagEditDialog from "@/components/TagEditDialog";
import type { ImageItem } from "@/types/image";
import { useBatchSelect } from "@/lib/useBatchSelect";
import { useSearchJump } from "@/lib/searchJump";
import ConfirmDialog from '@/components/ConfirmDialog';
import BatchBar from "@/components/BatchBar";
import BatchCheckbox from "@/components/BatchCheckbox";
import DropZone from "@/components/DropZone";
import { cn, formatFileSize } from "@/lib/utils";
import { useFavoritesStore } from "@/stores/favoritesStore";
import { tagColor } from "@/lib/tagColor";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeStore } from "@/stores/themeStore";
import { readFileSafe } from "@/lib/readFileSafe";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, X, Upload, Loader2, Star, Image, ImageIcon, Trash2, Tag, CheckSquare, Maximize2, Minimize2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/EmptyState";
import LayoutSwitch, { type LayoutMode } from "@/components/LayoutSwitch";
import { useLayoutMode } from "@/lib/useLayoutMode";
import PaginationBar from "@/components/PaginationBar";
import { usePagination } from "@/lib/usePagination";
import { useToast } from "@/components/Toast";
import { importMediaPaths, pickFolderAndImport, importSummaryText } from "@/lib/mediaScan";
import { FolderOpen } from "lucide-react";

async function toBlobUrl(filePath: string): Promise<string> {
  if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("blob:") || filePath.startsWith("data:") || filePath.startsWith("/themes/")) {
    return filePath;
  }
  const clean = filePath.replace(/^file:\/\/\//, "").replace(/^file:\/\//, "");
  try {
    const data = await readFileSafe(clean);
    const ext = (clean.split(".").pop() || "png").toLowerCase();
    const m: Record<string,string> = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", bmp:"image/bmp", svg:"image/svg+xml", ico:"image/x-icon" };
    return URL.createObjectURL(new Blob([data], { type: m[ext] || "image/png" }));
  } catch { return filePath; }
}

// ── Fullscreen auto-hide hint ──
function FullscreenHint({ onExit }: { onExit: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Reset timer on mouse enter, hide on leave
  const show = () => { setVisible(true); };
  const hideSoon = () => { setTimeout(() => setVisible(false), 3000); };

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <button onClick={onExit}
        className="text-white/50 hover:text-white text-xs bg-black/50 rounded-full px-4 py-2">
        <Minimize2 className="h-3.5 w-3.5 inline mr-1" />退出全屏 / Esc
      </button>
    </div>
  );
}

// ── Full-screen image viewer ──
function ImageViewer({ images, index, onClose, onIndex }: { images: string[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const dragRef = useRef({ sx: 0, sy: 0, px: 0, py: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoomed = zoom > 1;
  const wheelMode = useSettingsStore((s) => s.imageWheelMode);

  useEffect(() => { setZoom(1); setPos({ x: 0, y: 0 }); }, [index]);

  const clampPos = useCallback((z: number, px: number, py: number) => {
    const el = imgRef.current; if (!el || z <= 1) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const overX = (r.width * (z - 1)) / 2, overY = (r.height * (z - 1)) / 2;
    return { x: Math.max(-overX, Math.min(overX, px)), y: Math.max(-overY, Math.min(overY, py)) };
  }, []);

  const zoomAt = useCallback((newZ: number, cx: number, cy: number) => {
    const z = Math.max(0.2, Math.min(10, newZ));
    const el = imgRef.current; if (!el || z <= 1) { setZoom(z); setPos({ x: 0, y: 0 }); return; }
    const r = el.getBoundingClientRect();
    const mx = cx - r.left - r.width / 2, my = cy - r.top - r.height / 2;
    const ratio = z / (zoom || 1);
    setZoom(z);
    setPos((p) => clampPos(z, (p.x - mx) * ratio + mx, (p.y - my) * ratio + my));
  }, [zoom, clampPos]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelMode === "zoom") {
        const delta = e.deltaY > 0 ? -0.3 : 0.3;
        zoomAt(zoom + delta, e.clientX, e.clientY);
      } else {
        if (e.deltaY > 20) onIndex(Math.min(images.length - 1, index + 1));
        else if (e.deltaY < -20) onIndex(Math.max(0, index - 1));
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { fullscreen ? setFullscreen(false) : onClose(); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") onIndex(Math.max(0, index - 1));
      if (e.key === "ArrowRight" || e.key === "PageDown") onIndex(Math.min(images.length - 1, index + 1));
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setFullscreen((v) => !v); }
    };
    const el = document.getElementById("img-viewer-overlay");
    el?.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => { el?.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  }, [zoom, index, zoomAt, onClose, onIndex, images.length, fullscreen, wheelMode]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const stopZoom = () => { if (zoomInterval.current) { clearInterval(zoomInterval.current); zoomInterval.current = null; } };
  const startZoom = (dir: 1 | -1) => {
    stopZoom();
    const step = dir * 0.25;
    zoomInterval.current = setInterval(() => {
      setZoom((z) => {
        const nz = Math.max(0.2, Math.min(10, z + step));
        zoomRef.current = nz;
        return nz;
      });
    }, 80);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!zoomed || e.button !== 0) return;
    setDragging(true);
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.sx, dy = e.clientY - dragRef.current.sy;
    setPos(clampPos(zoom, dragRef.current.px + dx, dragRef.current.py + dy));
  };
  const onMouseUp = () => setDragging(false);

  const toolbar = !fullscreen ? (
    <div className="absolute bottom-8 left-0 right-0 z-20 flex items-center justify-center">
      <div className="flex items-center gap-1 bg-black/80 rounded-xl px-3 py-2">
        <button disabled={index <= 0} onClick={() => onIndex(index - 1)} className="text-white/70 hover:text-white disabled:opacity-30 p-1.5"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-xs text-white/60 tabular-nums w-14 text-center">{index + 1} / {images.length}</span>
        <button disabled={index >= images.length - 1} onClick={() => onIndex(index + 1)} className="text-white/70 hover:text-white disabled:opacity-30 p-1.5"><ChevronRight className="h-5 w-5" /></button>
        <div className="w-px h-4 bg-white/20 mx-2" />
        <button onMouseDown={() => startZoom(-1)} onMouseUp={stopZoom} onMouseLeave={stopZoom}
          onClick={() => zoomAt(zoom - 0.25, window.innerWidth/2, window.innerHeight/2)}
          className="text-white/70 hover:text-white p-1.5"><ZoomOut className="h-4 w-4" /></button>
        <span className="text-xs text-white/60 w-10 text-center tabular-nums cursor-pointer" onClick={() => { setZoom(1); setPos({x:0,y:0}); }}>{Math.round(zoom * 100)}%</span>
        <button onMouseDown={() => startZoom(1)} onMouseUp={stopZoom} onMouseLeave={stopZoom}
          onClick={() => zoomAt(zoom + 0.25, window.innerWidth/2, window.innerHeight/2)}
          className="text-white/70 hover:text-white p-1.5"><ZoomIn className="h-4 w-4" /></button>
        <button onClick={() => { setZoom(1); setPos({x:0,y:0}); }} className="text-white/70 hover:text-white p-1.5" title="Ctrl+0"><RotateCcw className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-white/20 mx-2" />
        <button onClick={() => setFullscreen(true)} className="text-white/70 hover:text-white p-1.5" title="F"><Maximize2 className="h-4 w-4" /></button>
        <button onClick={onClose} className="text-white/70 hover:text-white p-1.5"><X className="h-4 w-4" /></button>
      </div>
    </div>
  ) : null;

  return createPortal(
    <div id="img-viewer-overlay" className="fixed inset-0 z-[200] bg-black/95 select-none"
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      style={{ cursor: zoomed ? (dragging ? "grabbing" : "grab") : "default" }}>
      <div className="w-full h-full flex items-center justify-center overflow-hidden"
        onDoubleClick={(e) => { zoom > 1 ? (setZoom(1), setPos({x:0,y:0})) : zoomAt(2.5, e.clientX, e.clientY); }}>
        <img
          ref={imgRef}
          src={images[index]}
          alt=""
          draggable={false}
          className="max-w-full max-h-full object-contain transition-transform duration-75"
          style={{ transform: zoomed ? `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` : `scale(${zoom})` }}
        />
      </div>
      {toolbar}
      {fullscreen && <FullscreenHint onExit={() => setFullscreen(false)} />}
      {!fullscreen && index > 0 && (
        <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-30">
          <button onClick={() => onIndex(index - 1)} className="text-white bg-black/40 hover:bg-black/60 p-2 rounded-full"><ChevronLeft className="h-6 w-6" /></button>
        </div>
      )}
      {!fullscreen && index < images.length - 1 && (
        <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-30">
          <button onClick={() => onIndex(index + 1)} className="text-white bg-black/40 hover:bg-black/60 p-2 rounded-full"><ChevronRight className="h-6 w-6" /></button>
        </div>
      )}
    </div>,
    document.body
  );
}

export default function ImageLibrary() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { images, isLoading, loadImages, addImages, deleteImage, updateTags } = useImageStore();
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [tagEditItem, setTagEditItem] = useState<ImageItem | null>(null);
  const [layoutMode, setLayoutMode] = useLayoutMode("layout-images", "card");
  const { getByType, toggleFavorite, isFavorite } = useFavoritesStore();

  const [previewIdx, setPreviewIdx] = useState(-1);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const img of images) {
        if (cancelled) return;
        if (!blobUrls[img.coverPath]) map[img.coverPath] = await toBlobUrl(img.coverPath);
      }
      if (!cancelled && Object.keys(map).length) setBlobUrls((p) => ({ ...p, ...map }));
    })();
    return () => { cancelled = true; };
  }, [images]);

  useEffect(() => { loadImages(); }, []);

  const confirmThen = (msg, fn) => setConfirmDelete({ msg, onOk: fn });

  const handleSetWallpaper = useCallback((filePath: string) => {
    useSettingsStore.getState().setWallpaperConfig({ mode: "single", path: filePath });
    // Auto-switch to default theme so the wallpaper engine renders
    useThemeStore.getState().setTheme("default");
  }, []);

  const filtered = useMemo(() => {
    let r = activeTags.length ? images.filter((i) => activeTags.some((t) => i.tags?.includes(t))) : images;
    if (favOnly) { const ids = new Set(getByType("image")); r = r.filter((i) => ids.has(i.id)); }
    if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter((i) => i.name.toLowerCase().includes(q)); }
    return r;
  }, [images, activeTags, favOnly, getByType, searchQuery]);

  const pageSize = layoutMode === "small" ? 30 : 20;
  const { page, setPage, totalPages, paginated } = usePagination(filtered, pageSize);
  useSearchJump(filtered, pageSize, setPage);

  const allIds = useMemo(() => paginated.map((x) => x.id), [paginated]);
  const batch = useBatchSelect(allIds);

  const allTags = useMemo(() => {
    const tc = new Map<string, number>();
    images.forEach((i) => i.tags?.forEach((t) => tc.set(t, (tc.get(t)||0)+1)));
    return Array.from(tc.entries()).sort((a,b) => b[1]-a[1]);
  }, [images]);

  const tagNames = useMemo(() => allTags.map(([tag]) => tag), [allTags]);
  const viewerSrcs = useMemo(() => filtered.map((img) => blobUrls[img.coverPath] || img.coverPath), [filtered, blobUrls]);

  // 拖入的可能是文件或文件夹 — Rust 自动识别、递归展开、与库去重
  const handleDropImport = useCallback(async (paths: string[]) => {
    try {
      const r = await importMediaPaths(paths, "images");
      toast(importSummaryText(r, "张"), r.added > 0 ? "success" : "info");
    } catch { await addImages(paths); }
  }, [addImages]);

  const handleAddFolder = useCallback(async () => {
    try {
      const r = await pickFolderAndImport("images");
      if (r) toast(importSummaryText(r, "张"), r.added > 0 ? "success" : "info");
    } catch { /* not in Tauri */ }
  }, []);
  const handleAddImages = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true, filters: [{ name: "Images", extensions: ["png","jpg","jpeg","gif","webp","bmp"] }] });
      if (selected) await addImages(Array.isArray(selected) ? selected : [selected]);
    } catch { toast("请使用 Tauri 桌面环境运行", "error"); }
  }, [addImages]);
  const handleBatchDelete = useCallback(() => { confirmThen(t("image.confirm_batch_delete", { n: batch.selected.size }), async () => { for (const id of batch.selected) await deleteImage(id); batch.clear(); }); }, [batch, deleteImage, t]);
  const handleBatchTag = useCallback(async (tags: string[]) => { for (const id of batch.selected) await updateTags(id, tags); batch.clear(); }, [batch, updateTags]);

  const openViewer = useCallback((img: ImageItem) => {
    const idx = filtered.findIndex((i) => i.id === img.id);
    if (idx >= 0) setPreviewIdx(idx);
  }, [filtered]);

  return (
    <>
    <DropZone onDrop={handleDropImport} accept={".png,.jpg,.jpeg,.gif,.webp,.bmp"} allowFolders>
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">{t("image.title")}</h1>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input placeholder={t("image.search", "搜索图片...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-7" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <button onClick={() => setFavOnly((v) => !v)} className={cn("h-8 w-8 rounded-md border transition-colors flex items-center justify-center", favOnly ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400" : "border-primary text-gray-500 hover:border-yellow-400/30 hover:text-yellow-400")}><Star className="h-4 w-4" /></button>
        <Button onClick={handleAddImages} className="h-8 w-8 p-0" title={t("image.add")}><Upload className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={handleAddFolder} className="h-8 w-8 p-0" title="选择文件夹导入"><FolderOpen className="h-4 w-4" /></Button>
        {!batch.showCheckboxes ? (
          <Button variant="outline" onClick={batch.enterBatchMode} className="h-8 w-8 p-0" title={t("batch.enter")}><CheckSquare className="h-4 w-4" /></Button>
        ) : (
          <Button variant="outline" onClick={batch.leaveBatchMode} className="h-8 w-8 p-0" title={t("batch.exit")}><X className="h-4 w-4" /></Button>
        )}
        <LayoutSwitch mode={layoutMode} onChange={setLayoutMode} />
      </div>
      <TagFilterBar tags={allTags} activeTags={activeTags} onToggle={(tag) => setActiveTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag])} onClear={() => setActiveTags([])} t={t} />
      {isLoading && <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-light" /></div>}
      {filtered.length > 0 ? (
        <>
          {layoutMode === "list" ? (
            <div className="flex flex-col gap-1">
              {paginated.map((img) => (
                <div key={img.id} className="relative flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-lighter transition-colors cursor-pointer group"
                  onClick={() => { if (!batch.showCheckboxes) openViewer(img); }}>
                  {batch.showCheckboxes && (
                    <BatchCheckbox inline checked={batch.selected.has(img.id)} onToggle={() => batch.toggle(img.id)} />
                  )}
                  <div className="w-16 h-12 rounded overflow-hidden bg-surface-lighter shrink-0">
                    <SafeImage src={img.coverPath} alt={img.name} className="w-full h-full object-cover"
                      fallback={<div className="flex h-full items-center justify-center"><ImageIcon className="h-4 w-4 text-gray-600" /></div>} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{img.name}</p>
                    <p className="text-xs text-gray-500">{img.resolution} · {formatFileSize(img.fileSize)}</p>
                    {img.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {img.tags.map((tag) => {
                          const c = tagColor(tag);
                          return <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border transition-colors" style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.fg + "40" }}>{tag}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(img.id, "image"); }} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-surface-lighter/50 transition-colors">
                      <Star className={cn("h-4 w-4", isFavorite(img.id) ? "fill-yellow-400 text-yellow-400" : "")} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setTagEditItem(img); }} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-light hover:bg-surface-lighter/50 transition-colors"><Tag className="h-4 w-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); confirmThen(t("image.confirm_delete"), () => deleteImage(img.id)); }} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-surface-lighter/50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={layoutMode === "card" ? "grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "grid gap-3 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"}>
              {paginated.map((img) => (
                <div key={img.id} className="relative group cursor-pointer" onClick={() => { if (!batch.showCheckboxes) openViewer(img); }}>
                  {batch.showCheckboxes && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute top-2 right-2 z-10">
                      <BatchCheckbox checked={batch.selected.has(img.id)} onToggle={() => batch.toggle(img.id)} />
                    </div>
                  )}
                  <ImageCard image={img} onDelete={(id) => confirmThen(t("image.confirm_delete"), () => deleteImage(id))} onSetWallpaper={handleSetWallpaper} onEditTags={() => setTagEditItem(img)} compact={layoutMode === "small"} favorited={isFavorite(img.id)} onToggleFav={() => toggleFavorite(img.id, "image")} />
                </div>
              ))}
            </div>
          )}
          <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
        </>
      ) : !isLoading && (
        <EmptyState icon={<Image className="h-16 w-16" />} title={t("image.no_images")} hint={t("image.no_images_hint")} />
      )}
      {confirmDelete && <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.msg || ''} onConfirm={() => { confirmDelete?.onOk(); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} />}
          {tagEditItem && <TagEditDialog open={true} onClose={() => setTagEditItem(null)} itemName={tagEditItem.name} tags={tagEditItem.tags || []} allTags={tagNames} onSave={(ts) => updateTags(tagEditItem.id, ts)} t={t} />}
    </div>
    </DropZone>
    {batch.showCheckboxes && <BatchBar selected={Array.from(batch.selected)} selectAll={batch.selectAll} clear={batch.leaveBatchMode} invert={batch.invert} onDelete={handleBatchDelete} allTags={tagNames} onBatchTag={handleBatchTag} t={t} />}
    {previewIdx >= 0 && viewerSrcs[previewIdx] && (
      <ImageViewer images={viewerSrcs} index={previewIdx} onClose={() => setPreviewIdx(-1)} onIndex={setPreviewIdx} />
    )}
    </>
  );
}
