/*
  ═══════════════════════════════════════════════════════════════
  QuickHub — Design Token System
  ═══════════════════════════════════════════════════════════════
  U = 4px               base grid unit — all spacing derives from this

  ICON_SM  =  4U  16px   h-4/w-4  (item icons)
  ICON_LG  =  7U  28px   h-7/w-7  (sidebar category icons)
  GAP_SM   =  2U   8px   gap-2    (item↔item, icon↔label)
  GAP_MD   =  3U  12px   gap-3    (music player internals)
  GAP_LG   =  4U  16px   gap-4    (sidebar↔items)
  PAD_SM   =  3U  12px   px-3     (item button inner x)
  PAD_LG   =  5U  20px   px-5     (section outer x padding)
  SIDEBAR  = 24U  96px   w-24     (category label column)

  item button  = PAD_SM×2 + ICON_SM + GAP_SM + text_avg(48) = 96px
  items grid   = MAX_PER_ROW × 96 + (MAX_PER_ROW-1) × GAP_SM = 408px
  content row  = SIDEBAR + GAP_LG + grid = 520px
  container    = PAD_LG×2 + content = 560px → round 576px
  MAX_PER_ROW  = 4
  ═══════════════════════════════════════════════════════════════
*/

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Maximize2,
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Trash2, Terminal, Cog, FileText, FolderOpen, Monitor,
  Download, Folder, ImageIcon, FolderHeart, Clapperboard,
  Lock, Moon, Power, RotateCcw, MonitorX,
  Scissors, Calculator, HardDrive, ScanSearch, ShieldAlert, Info,
  Video, Wifi, Bluetooth,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAudioPlayerStore, fmtTime } from "@/stores/audioPlayerStore";
import { getMusicCoverFallback, musicCoverSrc } from "@/lib/musicCoverFallback";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "@/components/ConfirmDialog";

// ── derived constants ─────────────────────────────────────
const SIDEBAR_W = 96; // 24U — category label column
const MAX_PER_ROW = 4; // items per row in tool grids
const CONTAINER_W = 576; // 144U — max container width, see token calc above

interface QuickHubProps { onClose: () => void }

export default function QuickHub({ onClose }: QuickHubProps) {
  const { t } = useTranslation();
  const [confirmQuit, setConfirmQuit] = useState(false);
  return (
    <div
      className="w-full rounded-2xl overflow-hidden animate-media-strip-up"
      style={{
        background: "rgba(8,12,20,0.82)",
        backdropFilter: "blur(18px) saturate(150%)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -6px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
        maxWidth: CONTAINER_W,
      }}
    >
      {/* title bar — PAD_LG x, compact y */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <span className="text-[10px] text-gray-500 tracking-[0.15em] uppercase select-none">{t("settings.quick_hub")}</span>
        <button onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors" title={t("quickHub.collapse")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <HubMusicPlayer />
      <div className="mx-5 h-px bg-white/[0.06]" />
      <SystemTools />

      {/* quit button */}
      <div className="mx-5 h-px bg-white/[0.06]" />
      <div className="px-5 py-3 flex justify-end">
        <button onClick={() => setConfirmQuit(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/6 transition-colors">
          <LogOut className="h-4 w-4" />
          <span>{t("quickHub.quit")}</span>
        </button>
      </div>

      {confirmQuit && (
        <ConfirmDialog open message={t("quickHub.confirm_quit")}
          confirmLabel={t("quickHub.quit")}
          onConfirm={async () => { const { exit } = await import("@tauri-apps/plugin-process"); exit(0); }}
          onCancel={() => setConfirmQuit(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HubMusicPlayer — PAD_LG x, PAD_MD (3U=12px) y
// ═══════════════════════════════════════════════════════

function HubMusicPlayer() {
  const { t } = useTranslation();
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
      <div className="mx-5 h-px bg-white/[0.06]" />
      <div className="flex items-center gap-3 px-5 py-3">
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] shrink-0">
          <img src={musicCoverSrc(track.coverPath)} alt="" className="w-full h-full object-cover"
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
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors ml-1" title={t("quickHub.open_player")}>
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// SystemTools — grid-cols-4, SIDEBAR_W sidebar, PAD_LG outer
// ═══════════════════════════════════════════════════════

interface ToolItem { key: string; icon: React.ComponentType<{className?: string}>; i18nKey: string; cmd: string; danger?: boolean }
interface ToolGroup { key: string; icon: React.ComponentType<{className?: string}>; i18nKey: string; items: ToolItem[] }

function SystemTools() {
  const { t } = useTranslation();
  const [sysVol, setSysVol] = useState(0.5);
  const [sysMuted, setSysMuted] = useState(false);
  const [volLoaded, setVolLoaded] = useState(false);
  const [confirming, setConfirming] = useState<ToolItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingVol = useRef<{ level: number; muted: boolean } | null>(null);

  const TOOL_GROUPS: ToolGroup[] = [
    { key: "folders", icon: FolderOpen, i18nKey: "quickHub.folders", items: [
      { key: "mycomputer",   icon: Monitor,      i18nKey: "quickHub.my_computer",  cmd: "open_my_computer" },
      { key: "desktop",      icon: Folder,       i18nKey: "quickHub.desktop",      cmd: "open_desktop" },
      { key: "downloads",    icon: Download,     i18nKey: "quickHub.downloads",    cmd: "open_downloads" },
      { key: "documents",    icon: FolderOpen,   i18nKey: "quickHub.documents",    cmd: "open_documents" },
      { key: "pictures",     icon: ImageIcon,    i18nKey: "quickHub.pictures",     cmd: "open_pictures" },
      { key: "music-folder", icon: FolderHeart,  i18nKey: "quickHub.music_folder", cmd: "open_music_folder" },
      { key: "videos",       icon: Clapperboard, i18nKey: "quickHub.videos",       cmd: "open_videos" },
    ]},
    { key: "power", icon: Power, i18nKey: "quickHub.power_session", items: [
      { key: "lock",     icon: Lock,      i18nKey: "quickHub.lock_screen", cmd: "lock_screen" },
      { key: "sleep",    icon: Moon,      i18nKey: "quickHub.sleep",       cmd: "sleep" },
      { key: "restart",  icon: RotateCcw, i18nKey: "quickHub.restart",    cmd: "restart",  danger: true },
      { key: "shutdown", icon: Power,     i18nKey: "quickHub.shutdown",   cmd: "shutdown", danger: true },
    ]},
    { key: "tools", icon: Cog, i18nKey: "quickHub.sys_tools", items: [
      { key: "taskmgr",       icon: MonitorX,    i18nKey: "quickHub.taskmgr",       cmd: "open_taskmgr" },
      { key: "snipping",      icon: Scissors,    i18nKey: "quickHub.snipping",      cmd: "open_snipping_tool" },
      { key: "gamebar",       icon: Video,       i18nKey: "quickHub.gamebar",       cmd: "open_game_bar" },
      { key: "calculator",    icon: Calculator,  i18nKey: "quickHub.calculator",    cmd: "open_calculator" },
      { key: "devmgmt",       icon: HardDrive,   i18nKey: "quickHub.devmgmt",       cmd: "open_device_manager" },
      { key: "cleanmgr",      icon: ScanSearch,  i18nKey: "quickHub.cleanmgr",      cmd: "open_disk_cleanup" },
      { key: "regedit",       icon: ShieldAlert, i18nKey: "quickHub.regedit",       cmd: "open_registry_editor" },
      { key: "msinfo32",      icon: Info,        i18nKey: "quickHub.system_info",   cmd: "open_system_info" },
      { key: "control-panel", icon: Cog,         i18nKey: "quickHub.control_panel", cmd: "open_control_panel" },
      { key: "cmd-admin",     icon: Terminal,    i18nKey: "quickHub.cmd",           cmd: "open_cmd_admin" },
      { key: "empty-recycle", icon: Trash2,      i18nKey: "quickHub.empty_recycle", cmd: "empty_recycle_bin" },
      { key: "notepad",       icon: FileText,    i18nKey: "quickHub.notepad",       cmd: "open_notepad" },
    ]},
  ];

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
      {/* systemTools always renders its own top separator so HubMusicPlayer can be absent without a stray line */}
      <div className="mx-5 h-px bg-white/[0.06]" />
      <div className="px-5 py-4 space-y-4 select-none">

        {/* Volume + quick toggles */}
        <div className="flex items-center gap-3">
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
          <button onClick={() => invoke("open_bluetooth_settings").catch(() => {})}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-400 hover:bg-white/5 transition-colors" title={t("quickHub.bluetooth")}>
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
            ? t("quickHub.confirm_empty_recycle")
            : t("quickHub.confirm_danger", { action: confirming ? t(confirming.i18nKey) : "" })}
          confirmLabel={t("quickHub.confirm_label")}
          onConfirm={doConfirm}
          onCancel={() => setConfirming(null)}
        />

        {TOOL_GROUPS.map((grp) => (
          <div key={grp.key} className="flex gap-4">
            {/* sidebar — SIDEBAR_W (24U = 96px) */}
            <div
              className="shrink-0 flex flex-col items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.05] py-3 gap-1.5"
              style={{ width: SIDEBAR_W }}
            >
              <grp.icon className="h-7 w-7 text-gray-400" />
              <span className="text-[11px] text-gray-500 font-medium text-center leading-tight">{t(grp.i18nKey)}</span>
            </div>
            {/* items grid — MAX_PER_ROW columns, GAP_SM gap */}
            <div
              className="flex-1 grid gap-2 items-start"
              style={{ gridTemplateColumns: `repeat(${MAX_PER_ROW}, 1fr)` }}
            >
              {grp.items.map((tool) => (
                <button key={tool.key} onClick={() => handleTool(tool)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors group min-w-0 ${
                    tool.danger ? "text-gray-500 hover:text-red-400 hover:bg-red-400/6" : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`} title={t(tool.i18nKey)}>
                  <tool.icon className={`h-4 w-4 shrink-0 transition-colors ${tool.danger ? "group-hover:text-red-400" : "group-hover:text-primary-light"}`} />
                  <span className={`truncate ${tool.danger ? "group-hover:text-red-300" : "group-hover:text-gray-200"}`}>{t(tool.i18nKey)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
