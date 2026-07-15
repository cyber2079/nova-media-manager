import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Film, Image, Gamepad2, Music,
  ChevronLeft, ChevronRight, Maximize2, X,
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Trash2, Terminal, Cog, FileText, FolderOpen, Monitor,
  Download, Folder, ImageIcon, FolderHeart, Clapperboard,
  Lock, Moon, Power, RotateCcw, MonitorX,
  Scissors, Calculator, HardDrive, ScanSearch, ShieldAlert, Info, Loader2,
  Video, Wifi, Bluetooth,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useMovieStore } from "@/stores/movieStore";
import { useImageStore } from "@/stores/imageStore";
import { useMusicStore } from "@/stores/musicStore";
import { useGameStore } from "@/stores/gameStore";
import { useAudioPlayerStore, fmtTime } from "@/stores/audioPlayerStore";
import { getMusicCoverFallback } from "@/lib/musicCoverFallback";
import { useTranslation } from "react-i18next";
import { setHomeMode } from "@/lib/homeMode";
import ConfirmDialog from "@/components/ConfirmDialog";

const SWIPE_THRESHOLD = 40;

interface QuickHubProps { onClose: () => void }

export default function QuickHub({ onClose }: QuickHubProps) {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden animate-media-strip-up"
      style={{
        background: "rgba(8,12,20,0.82)",
        backdropFilter: "blur(18px) saturate(150%)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -6px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-0.5">
        <span className="text-[10px] text-gray-500 tracking-[0.15em] uppercase select-none">快捷中心</span>
        <div className="flex items-center gap-1">
          <button onClick={() => { onClose(); setHomeMode("full"); }}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors" title="展开完整面板">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors" title="收起">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      <MediaCarousel />
      <HubMusicPlayer />
      <SystemTools />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MediaCarousel
// ═══════════════════════════════════════════════════════

function MediaCarousel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const movies = useMovieStore((s) => s.movies);
  const images = useImageStore((s) => s.images);
  const music = useMusicStore((s) => s.music);
  const games = useGameStore((s) => s.games);

  const pages = [
    { key: "movies", icon: Film,    count: movies.length, color: "var(--color-primary)",       to: "/movies", recent: movies.slice(-8).reverse() },
    { key: "images", icon: Image,   count: images.length, color: "var(--color-accent)",         to: "/images", recent: images.slice(-8).reverse() },
    { key: "music",  icon: Music,   count: music.length,  color: "var(--color-primary-light)",  to: "/music",  recent: music.slice(-8).reverse() },
    { key: "games",  icon: Gamepad2,count: games.length,  color: "var(--color-primary-dark)",   to: "/games",  recent: games.slice(-8).reverse() },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const swipeStartRef = useRef(0);

  // Movie viewer
  const [playingItem, setPlayingItem] = useState<{ name: string; src: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Image viewer
  const [viewingImage, setViewingImage] = useState<{ name: string; src: string } | null>(null);

  const goTo = useCallback((index: number) => { setActiveIndex(index); setSwipeOffset(0); setSwiping(false); }, []);
  const goNext = () => { if (activeIndex < pages.length - 1) goTo(activeIndex + 1); };
  const goPrev = () => { if (activeIndex > 0) goTo(activeIndex - 1); };

  const onPointerDown = useCallback((e: React.PointerEvent) => { swipeStartRef.current = e.clientX; setSwiping(true); setSwipeOffset(0); }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!swiping) return;
    const delta = e.clientX - swipeStartRef.current;
    setSwipeOffset((activeIndex === 0 && delta > 0) || (activeIndex === pages.length - 1 && delta < 0) ? delta * 0.2 : delta);
  }, [swiping, activeIndex]);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!swiping) return;
    const delta = e.clientX - swipeStartRef.current;
    if (delta < -SWIPE_THRESHOLD && activeIndex < pages.length - 1) goTo(activeIndex + 1);
    else if (delta > SWIPE_THRESHOLD && activeIndex > 0) goTo(activeIndex - 1);
    else { setSwipeOffset(0); setSwiping(false); }
  }, [swiping, activeIndex, goTo]);

  const handleItemClick = useCallback((pageKey: string, item: any) => {
    if (pageKey === "games") { useGameStore.getState().launchGame(item.id).catch(() => {}); return; }
    if (pageKey === "music") {
      import("@/stores/audioPlayerStore").then((m) => { m.useAudioPlayerStore.getState().play(item); }).catch(() => {});
      return;
    }
    if (pageKey === "movies") { playMovie(item); return; }
    if (pageKey === "images") { viewImage(item); return; }
    navigate(pages.find((p) => p.key === pageKey)!.to);
  }, [navigate]);

  const playMovie = useCallback(async (movie: any) => {
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const ext = (movie.filePath.split(".").pop() || "mp4").toLowerCase();
      const mimeMap: Record<string,string> = { mp4:"video/mp4", webm:"video/webm", mov:"video/quicktime", avi:"video/x-msvideo", mkv:"video/x-matroska", flv:"video/x-flv", wmv:"video/x-ms-wmv", m4v:"video/mp4" };
      const data = await readFile(movie.filePath);
      const blob = new Blob([data], { type: mimeMap[ext] || "video/mp4" });
      setPlayingItem({ name: movie.name, src: URL.createObjectURL(blob) });
    } catch { /* file read error */ }
  }, []);

  const viewImage = useCallback(async (img: any) => {
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const ext = (img.filePath.split(".").pop() || "png").toLowerCase();
      const mimeMap: Record<string,string> = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp", bmp:"image/bmp", gif:"image/gif" };
      const data = await readFile(img.filePath);
      const blob = new Blob([data], { type: mimeMap[ext] || "image/png" });
      setViewingImage({ name: img.name, src: URL.createObjectURL(blob) });
    } catch { /* file read error */ }
  }, []);

  const closePlayer = useCallback(() => {
    if (playingItem) { URL.revokeObjectURL(playingItem.src); setPlayingItem(null); }
  }, [playingItem]);
  const closeViewer = useCallback(() => {
    if (viewingImage) { URL.revokeObjectURL(viewingImage.src); setViewingImage(null); }
  }, [viewingImage]);

  const trackTransform = (() => {
    const basePct = -activeIndex * 100;
    return swipeOffset === 0 ? `translateX(${basePct}%)` : `translateX(calc(${basePct}% + ${swipeOffset}px))`;
  })();

  return (
    <div>
      <div className="flex items-center h-14 px-3 gap-2">
        <button onClick={goPrev} disabled={activeIndex === 0}
          className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/8 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 overflow-hidden h-full"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={() => { setSwipeOffset(0); setSwiping(false); }}>
          <div className="flex h-full" style={{ transform: trackTransform, transition: swiping ? "none" : "transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)" }}>
            {pages.map((p) => (
              <div key={p.key} className="w-full flex-shrink-0 h-full flex items-center gap-3 px-1 select-none">
                <button onClick={() => navigate(p.to)} className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
                  <p.icon className="h-4 w-4" style={{ color: p.color, filter: "brightness(1.3)" }} />
                  <span className="text-xs font-medium text-white">{t(`nav.${p.key}`)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-gray-400 leading-none">{p.count}</span>
                </button>
                <div className="w-px h-4 bg-white/[0.06] shrink-0" />
                <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
                  {p.recent.length > 0 ? p.recent.map((item: any, i: number) => (
                    <button key={i} onClick={() => handleItemClick(p.key, item)}
                      className="shrink-0 px-2.5 py-1 rounded-md text-[11px] text-[#c8ddf0] bg-white/[0.06] hover:bg-primary/15 hover:text-white transition-colors truncate max-w-[150px]" title={item.name}>
                      {item.name}
                    </button>
                  )) : <span className="text-[10px] text-gray-600">{t("home.recent_use_empty")}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={goNext} disabled={activeIndex === pages.length - 1}
          className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/8 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5 pb-2">
        {pages.map((p, i) => (
          <button key={p.key} onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${i === activeIndex ? "bg-primary-light w-3 h-1" : "bg-white/[0.12] hover:bg-white/25 w-1 h-1"}`} />
        ))}
      </div>

      {/* Movie player — portal to document.body to escape stacking context */}
      {playingItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md" onClick={closePlayer}>
          <div className="relative max-w-[95vw] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={closePlayer} className="absolute -top-2 -right-2 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors border border-white/10">
              <X className="h-4 w-4" />
            </button>
            <video ref={videoRef} controls autoPlay className="max-w-[95vw] max-h-[90vh] rounded-xl shadow-2xl" src={playingItem.src} />
            <div className="absolute bottom-3 left-3 text-xs text-white/50 bg-black/40 px-2 py-1 rounded">{playingItem.name}</div>
          </div>
        </div>, document.body
      )}

      {/* Image viewer — portal to document.body */}
      {viewingImage && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={closeViewer}>
          <button onClick={closeViewer} className="absolute top-4 right-4 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
            <X className="h-5 w-5" />
          </button>
          <img src={viewingImage.src} alt={viewingImage.name}
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-4 left-4 text-xs text-white/50 bg-black/40 px-2.5 py-1 rounded">{viewingImage.name}</div>
        </div>, document.body
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HubMusicPlayer
// ═══════════════════════════════════════════════════════

function HubMusicPlayer() {
  const navigate = useNavigate();
  const track = useAudioPlayerStore((s) => s.track);
  const dur = useAudioPlayerStore((s) => s.duration);
  const time = useAudioPlayerStore((s) => s.currentTime);
  const vol = useAudioPlayerStore((s) => s.volume);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const doToggle = useAudioPlayerStore((s) => s.toggle);
  const doSetVol = useAudioPlayerStore((s) => s.setVolume);
  const doPrev = useAudioPlayerStore((s) => s.prev);
  const doNext = useAudioPlayerStore((s) => s.next);
  const doSetBg = useAudioPlayerStore((s) => s.setBackground);
  const [seeking, setSeeking] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const pct = dur > 0 && track ? (time / dur) * 100 : 0;

  const seekTo = useCallback((clientX: number) => {
    if (!barRef.current || !dur) return;
    const rect = barRef.current.getBoundingClientRect();
    useAudioPlayerStore.getState().seek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  }, [dur]);

  const onMouseDown = useCallback((e: React.MouseEvent) => { setSeeking(true); seekTo(e.clientX); }, [seekTo]);

  useEffect(() => {
    if (!seeking) return;
    const onMove = (e: MouseEvent) => seekTo(e.clientX);
    const onUp = () => setSeeking(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [seeking, seekTo]);

  if (!track) return null;

  return (
    <>
      <div className="mx-4 h-px bg-white/[0.06]" />
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] shrink-0">
          <img src={track.coverPath || getMusicCoverFallback()} alt="" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = getMusicCoverFallback(); }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white truncate font-medium">{track.name}</span>
            <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">{fmtTime(time)} / {fmtTime(dur)}</span>
          </div>
          <div ref={barRef} className="w-full flex items-center cursor-pointer h-4 -mb-1" onMouseDown={onMouseDown}>
            <div className="w-full h-[2px] rounded-full bg-white/[0.08] relative hover:h-[3px] transition-all">
              <div className="absolute left-0 top-0 h-full rounded-full bg-primary-light"
                style={{ width: `${pct}%`, transition: seeking ? "none" : "width 0.3s linear" }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => vol === 0 ? doSetVol(1) : doSetVol(0)} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors">
            {vol === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={doPrev} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors"><SkipBack className="h-3.5 w-3.5" /></button>
          <button onClick={doToggle} className="h-8 w-8 flex items-center justify-center rounded-full bg-primary/20 text-primary-light hover:bg-primary/30 transition-colors">
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>
          <button onClick={doNext} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors"><SkipForward className="h-3.5 w-3.5" /></button>
          <button onClick={() => { doSetBg(false); navigate("/music"); }}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors ml-1" title="打开完整播放器">
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// SystemTools
// ═══════════════════════════════════════════════════════

interface ToolItem { key: string; icon: React.ComponentType<{className?: string}>; label: string; cmd: string; danger?: boolean }
interface ToolGroup { key: string; icon: React.ComponentType<{className?: string}>; label: string; items: ToolItem[] }

const TOOL_GROUPS: ToolGroup[] = [
  { key: "folders", icon: FolderOpen, label: "常用文件夹", items: [
    { key: "mycomputer",   icon: Monitor,      label: "我的电脑", cmd: "open_my_computer" },
    { key: "desktop",      icon: Folder,       label: "桌面",     cmd: "open_desktop" },
    { key: "downloads",    icon: Download,     label: "下载",     cmd: "open_downloads" },
    { key: "documents",    icon: FolderOpen,   label: "文档",     cmd: "open_documents" },
    { key: "pictures",     icon: ImageIcon,    label: "图片",     cmd: "open_pictures" },
    { key: "music-folder", icon: FolderHeart,  label: "音乐",     cmd: "open_music_folder" },
    { key: "videos",       icon: Clapperboard, label: "视频",     cmd: "open_videos" },
  ]},
  { key: "power", icon: Power, label: "电源 / 会话", items: [
    { key: "lock",     icon: Lock,      label: "锁屏", cmd: "lock_screen" },
    { key: "sleep",    icon: Moon,      label: "睡眠", cmd: "sleep" },
    { key: "restart",  icon: RotateCcw, label: "重启", cmd: "restart",  danger: true },
    { key: "shutdown", icon: Power,     label: "关机", cmd: "shutdown", danger: true },
  ]},
  { key: "tools", icon: Cog, label: "系统工具", items: [
    { key: "taskmgr",       icon: MonitorX,    label: "任务管理", cmd: "open_taskmgr" },
    { key: "snipping",      icon: Scissors,    label: "截图工具", cmd: "open_snipping_tool" },
    { key: "gamebar",       icon: Video,       label: "视频录制", cmd: "open_game_bar" },
    { key: "calculator",    icon: Calculator,  label: "计算器",   cmd: "open_calculator" },
    { key: "devmgmt",       icon: HardDrive,   label: "设备管理", cmd: "open_device_manager" },
    { key: "cleanmgr",      icon: ScanSearch,  label: "磁盘清理", cmd: "open_disk_cleanup" },
    { key: "regedit",       icon: ShieldAlert, label: "注册表",   cmd: "open_registry_editor" },
    { key: "msinfo32",      icon: Info,        label: "系统信息", cmd: "open_system_info" },
    { key: "control-panel", icon: Cog,         label: "控制面板", cmd: "open_control_panel" },
    { key: "cmd-admin",     icon: Terminal,    label: "CMD",      cmd: "open_cmd_admin" },
    { key: "empty-recycle", icon: Trash2,      label: "清空回收站", cmd: "empty_recycle_bin" },
    { key: "notepad",       icon: FileText,    label: "记事本",   cmd: "open_notepad" },
  ]},
];

function SystemTools() {
  const [sysVol, setSysVol] = useState(0.5);
  const [sysMuted, setSysMuted] = useState(false);
  const [volLoaded, setVolLoaded] = useState(false);
  const [confirming, setConfirming] = useState<ToolItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingVol = useRef<{ level: number; muted: boolean } | null>(null);

  useEffect(() => {
    invoke<number>("get_system_volume")
      .then((v) => { setSysVol(Math.round(v * 100) / 100); setVolLoaded(true); })
      .catch(() => {});
    return () => clearTimeout(debounceRef.current);
  }, []);

  const syncVolume = useCallback((level: number, muted: boolean) => {
    pendingVol.current = { level, muted };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = pendingVol.current;
      if (!p) return;
      // unmute first if needed, then set volume
      if (!p.muted) invoke("set_system_mute", { muted: false }).catch(() => {});
      invoke("set_system_volume", { level: p.muted ? 0 : p.level }).catch(() => {});
      pendingVol.current = null;
    }, 200);
  }, []);

  const applyVolume = useCallback((level: number, muted: boolean) => {
    const v = Math.round(level * 100) / 100;
    setSysVol(v);
    setSysMuted(muted);
    syncVolume(v, muted);
  }, [syncVolume]);

  const handleTool = useCallback((t: ToolItem) => {
    if (t.cmd === "empty_recycle_bin" || t.danger) { setConfirming(t); return; }
    invoke(t.cmd).catch(() => {});
  }, []);

  const doConfirm = useCallback(() => {
    if (!confirming) return;
    invoke(confirming.cmd).catch(() => {});
    setConfirming(null);
  }, [confirming]);

  const VolIcon = sysMuted || sysVol === 0 ? VolumeX : sysVol < 0.33 ? Volume1 : Volume2;

  return (
    <>
      <div className="mx-4 h-px bg-white/[0.06]" />
      <div className="px-5 py-4 space-y-4 select-none">

        {/* Volume + quick toggles */}
        <div className="flex items-center gap-3 max-w-sm">
          <button
            onClick={() => applyVolume(sysVol, !sysMuted)}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/6 transition-colors shrink-0"
          >
            <VolIcon className="h-5 w-5" />
          </button>
          <input
            type="range" min={0} max={100}
            value={Math.round(sysVol * 100)}
            onChange={(e) => applyVolume(Number(e.target.value) / 100, false)}
            className="flex-1 h-1.5 accent-primary-light cursor-pointer outline-none"
            style={{ opacity: volLoaded ? 1 : 0.3, outline: "none", WebkitTapHighlightColor: "transparent" }}
          />
          <span className="text-xs text-gray-400 w-9 text-right tabular-nums shrink-0 font-medium">
            {sysMuted ? "--" : `${Math.round(sysVol * 100)}`}
          </span>
          {/* Wireless toggles */}
          <button onClick={() => invoke("open_bluetooth_settings").catch(() => {})}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-400 hover:bg-white/5 transition-colors" title="蓝牙">
            <Bluetooth className="h-4 w-4" />
          </button>
          <button onClick={() => invoke("open_network_settings").catch(() => {})}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-colors" title="Wi-Fi">
            <Wifi className="h-4 w-4" />
          </button>
        </div>

        <ConfirmDialog
          open={!!confirming}
          message={confirming?.cmd === "empty_recycle_bin"
            ? "确定要清空回收站吗？此操作不可撤销。"
            : `确定要${confirming?.label ?? ""}吗？`}
          confirmLabel="确定"
          onConfirm={doConfirm}
          onCancel={() => setConfirming(null)}
        />

        {TOOL_GROUPS.map((grp) => (
          <div key={grp.key} className="flex gap-4">
            <div className="shrink-0 w-[100px] flex flex-col items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.05] py-3 gap-1.5">
              <grp.icon className="h-7 w-7 text-gray-400" />
              <span className="text-[11px] text-gray-500 font-medium text-center leading-tight">{grp.label}</span>
            </div>
            <div className="flex-1 flex flex-wrap gap-2 content-start">
              {grp.items.map((t) => (
                <button key={t.key} onClick={() => handleTool(t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors group ${
                    t.danger ? "text-gray-500 hover:text-red-400 hover:bg-red-400/6" : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`} title={t.label}>
                  <t.icon className={`h-4 w-4 transition-colors ${t.danger ? "group-hover:text-red-400" : "group-hover:text-primary-light"}`} />
                  <span className={t.danger ? "group-hover:text-red-300" : "group-hover:text-gray-200"}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
