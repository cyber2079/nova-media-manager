/*
  ═══════════════════════════════════════════════════════════════
  QuickHub — start menu with music player, tools, and system controls
  Layout: title bar → music player → [left: tool groups | right: BT/WiFi + volume]
  ═══════════════════════════════════════════════════════════════
*/

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Play, Pause, Volume2, VolumeX, Volume1,
  Trash2, Terminal, Cog, FileText, FolderOpen, Monitor,
  Download, Folder, ImageIcon, FolderHeart, Clapperboard,
  Lock, Moon, Power, RotateCcw, MonitorX,
  Scissors, Calculator, HardDrive, ScanSearch, ShieldAlert, Info,
  Video, Wifi, Bluetooth,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAudioPlayerStore, fmtTime } from "@/stores/audioPlayerStore";
import { musicCoverSrc } from "@/lib/musicCoverFallback";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import ConfirmDialog from "@/components/ConfirmDialog";
import NeonIcon from "@/components/NeonIcon";

const LEFT_COL_W = 100; // px — left column (BT + WiFi + Volume)
const SIDEBAR_W = 96;   // category label column width

interface QuickHubProps { onClose: () => void; onOpenFolder: (path: string) => void }

export default function QuickHub({ onClose, onOpenFolder }: QuickHubProps) {
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
      }}
    >
      {/* title bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <span className="text-sm font-bold text-gray-300 tracking-[0.06em] uppercase select-none">{t("settings.quick_hub")}</span>
        <button onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors" title={t("quickHub.collapse")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <HubMusicPlayer />
      <div className="mx-5 h-px bg-white/[0.025]" />
      <TwoColumnBody onOpenFolder={onOpenFolder} />

      {/* quit button */}
      <div className="mx-5 h-px bg-white/[0.025]" />
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
// HubMusicPlayer — minimal now-playing strip
// ═══════════════════════════════════════════════════════

function HubMusicPlayer() {
  const navigate = useNavigate();
  const track = useAudioPlayerStore((s) => s.track);
  const dur = useAudioPlayerStore((s) => s.duration);
  const time = useAudioPlayerStore((s) => s.currentTime);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const doToggle = useAudioPlayerStore((s) => s.toggle);

  if (!track) return null;

  const pct = dur > 0 ? (time / dur) * 100 : 0;

  return (
    <>
      <div className="mx-5 h-px bg-white/[0.025]" />
      <div className="flex items-center gap-3 px-5 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => navigate("/music")}>
        <div className="w-8 h-8 rounded overflow-hidden bg-white/[0.025] shrink-0 flex items-center justify-center relative">
          <NeonIcon name="Headphones" size={14} />
          {track.coverPath && (
            <img src={musicCoverSrc(track.coverPath)} alt="" className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white truncate font-medium">{track.name}</span>
            <span className="text-[10px] text-gray-500 shrink-0">{fmtTime(time)} / {fmtTime(dur)}</span>
          </div>
          <div className="w-full h-[2px] rounded-full bg-white/[0.025] mt-1">
            <div className="h-full rounded-full bg-primary-light transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); doToggle(); }}
          className="h-7 w-7 flex items-center justify-center rounded-full bg-primary/15 text-primary-light hover:bg-primary/25 transition-colors shrink-0">
          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// TwoColumnBody — left: tool groups, right: BT/WiFi + volume
// ═══════════════════════════════════════════════════════

interface ToolItem { key: string; icon: React.ComponentType<{className?: string}>; iconName: string; i18nKey: string; cmd: string; danger?: boolean }
interface ToolGroup { key: string; icon: React.ComponentType<{className?: string}>; i18nKey: string; items: ToolItem[] }

function TwoColumnBody({ onOpenFolder }: { onOpenFolder: (path: string) => void }) {
  const { t } = useTranslation();

  const TOOL_GROUPS: ToolGroup[] = [
    { key: "folders", icon: FolderOpen, i18nKey: "quickHub.folders", items: [
      { key: "mycomputer",   icon: Monitor,      iconName: "Monitor",      i18nKey: "quickHub.my_computer",  cmd: "open_my_computer" },
      { key: "desktop",      icon: Folder,       iconName: "FolderOpen",   i18nKey: "quickHub.desktop",      cmd: "open_desktop" },
      { key: "downloads",    icon: Download,     iconName: "Download",     i18nKey: "quickHub.downloads",    cmd: "open_downloads" },
      { key: "documents",    icon: FolderOpen,   iconName: "FolderOpen",   i18nKey: "quickHub.documents",    cmd: "open_documents" },
      { key: "pictures",     icon: ImageIcon,    iconName: "ImageIcon",    i18nKey: "quickHub.pictures",     cmd: "open_pictures" },
      { key: "music-folder", icon: FolderHeart,  iconName: "FolderHeart",  i18nKey: "quickHub.music_folder", cmd: "open_music_folder" },
      { key: "videos",       icon: Clapperboard, iconName: "Video",        i18nKey: "quickHub.videos",       cmd: "open_videos" },
    ]},
    { key: "power", icon: Power, i18nKey: "quickHub.power_session", items: [
      { key: "lock",     icon: Lock,      iconName: "Lock",      i18nKey: "quickHub.lock_screen", cmd: "lock_screen", danger: true },
      { key: "sleep",    icon: Moon,      iconName: "Moon",      i18nKey: "quickHub.sleep",       cmd: "sleep",       danger: true },
      { key: "restart",  icon: RotateCcw, iconName: "RotateCcw", i18nKey: "quickHub.restart",    cmd: "restart",  danger: true },
      { key: "shutdown", icon: Power,     iconName: "Power",     i18nKey: "quickHub.shutdown",   cmd: "shutdown", danger: true },
    ]},
    { key: "tools", icon: Cog, i18nKey: "quickHub.sys_tools", items: [
      { key: "taskmgr",       icon: MonitorX,    iconName: "Monitor",      i18nKey: "quickHub.taskmgr",       cmd: "open_taskmgr" },
      { key: "snipping",      icon: Scissors,    iconName: "Scissors",     i18nKey: "quickHub.snipping",      cmd: "open_snipping_tool" },
      { key: "gamebar",       icon: Video,       iconName: "Video",        i18nKey: "quickHub.gamebar",       cmd: "open_game_bar" },
      { key: "calculator",    icon: Calculator,  iconName: "Calculator",   i18nKey: "quickHub.calculator",    cmd: "open_calculator" },
      { key: "devmgmt",       icon: HardDrive,   iconName: "HardDrive",    i18nKey: "quickHub.devmgmt",       cmd: "open_device_manager" },
      { key: "cleanmgr",      icon: ScanSearch,  iconName: "Search",       i18nKey: "quickHub.cleanmgr",      cmd: "open_disk_cleanup" },
      { key: "regedit",       icon: ShieldAlert, iconName: "Shield",       i18nKey: "quickHub.regedit",       cmd: "open_registry_editor" },
      { key: "msinfo32",      icon: Info,        iconName: "Info",         i18nKey: "quickHub.system_info",   cmd: "open_system_info" },
      { key: "control-panel", icon: Cog,         iconName: "Settings",     i18nKey: "quickHub.control_panel", cmd: "open_control_panel" },
      { key: "cmd-admin",     icon: Terminal,    iconName: "Terminal",     i18nKey: "quickHub.cmd",           cmd: "open_cmd_admin" },
      { key: "empty-recycle", icon: Trash2,      iconName: "Trash2",       i18nKey: "quickHub.empty_recycle", cmd: "empty_recycle_bin" },
      { key: "notepad",       icon: FileText,    iconName: "FileText",     i18nKey: "quickHub.notepad",       cmd: "open_notepad" },
    ]},
  ];

  const FOLDER_PATH_KEYS: Record<string, string> = {
    open_my_computer: "",
    open_desktop: "desktop",
    open_downloads: "downloads",
    open_documents: "documents",
    open_pictures: "pictures",
    open_music_folder: "music",
    open_videos: "videos",
  };

  const [sysVol, setSysVol] = useState(0.5);
  const [sysMuted, setSysMuted] = useState(false);
  const [volLoaded, setVolLoaded] = useState(false);
  const [confirming, setConfirming] = useState<ToolItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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

  const handleTool = useCallback(async (t: ToolItem) => {
    if (t.cmd === "empty_recycle_bin" || t.danger) { setConfirming(t); return; }
    const style = useSettingsStore.getState().systemDialogStyle;
    const folderKey = FOLDER_PATH_KEYS[t.cmd];
    if (style === "theme" && folderKey !== undefined) {
      if (folderKey === "") { onOpenFolder(""); return; }
      try {
        const path = await invoke<string>("get_known_folder_path", { kind: folderKey });
        if (path) onOpenFolder(path);
      } catch { invoke(t.cmd).catch(() => {}); }
    } else {
      invoke(t.cmd).catch(() => {});
    }
  }, [onOpenFolder]);

  const doConfirm = useCallback(() => {
    if (!confirming) return;
    invoke(confirming.cmd).catch(() => {});
    setConfirming(null);
  }, [confirming]);

  const VolIcon = sysMuted || sysVol === 0 ? VolumeX : sysVol < 0.33 ? Volume1 : Volume2;

  return (
    <div className="px-5 pt-4 pb-2 select-none">
      <div className="flex gap-4">
        {/* ═══ LEFT — Bluetooth + WiFi (top) + Volume (bottom) ═══ */}
        <div className="shrink-0 flex flex-col" style={{ width: LEFT_COL_W }}>
          {/* Top: Bluetooth + WiFi */}
          <div className="flex flex-col gap-1">
            <button onClick={() => invoke("open_bluetooth_settings").catch(() => {})}
              className="h-10 flex items-center justify-center rounded-lg border border-white/[0.06] text-gray-400 hover:text-blue-400 hover:bg-white/5 transition-colors gap-1.5" title={t("quickHub.bluetooth")}>
              <NeonIcon name="Bluetooth" size={16}><Bluetooth className="h-4 w-4" /></NeonIcon>
              <span className="text-[11px]">BT</span>
            </button>
            <button onClick={() => invoke("open_network_settings").catch(() => {})}
              className="h-10 flex items-center justify-center rounded-lg border border-white/[0.06] text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-colors gap-1.5" title="Wi-Fi">
              <NeonIcon name="Wifi" size={16}><Wifi className="h-4 w-4" /></NeonIcon>
              <span className="text-[11px]">WiFi</span>
            </button>
          </div>

          {/* Separator */}
          <div className="my-3 h-px bg-white/[0.025]" />

          {/* Bottom: Vertical volume */}
          <div className="flex-1 flex flex-col items-center justify-end">
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => applyVolume(sysVol, !sysMuted)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/6 transition-colors"
              >
                <NeonIcon name={sysMuted || sysVol === 0 ? "VolumeX" : sysVol < 0.33 ? "Volume1" : "Volume2"} size={20}>
                  <VolIcon className="h-5 w-5" />
                </NeonIcon>
              </button>
              <input
                type="range" min={0} max={100}
                value={Math.round(sysVol * 100)}
                onChange={(e) => applyVolume(Number(e.target.value) / 100, false)}
                className="accent-primary-light cursor-pointer outline-none"
                style={{
                  opacity: volLoaded ? 1 : 0.3,
                  WebkitAppearance: "slider-vertical",
                  height: 140,
                  width: 20,
                  outline: "none",
                }}
              />
              <span className="text-xs text-gray-400 tabular-nums font-medium">
                {sysMuted ? "--" : `${Math.round(sysVol * 100)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="w-px bg-white/[0.025] shrink-0" />

        {/* ═══ RIGHT — tool groups with sidebar + 4-column grid ═══ */}
        <div className="flex-1 min-w-0 space-y-4">
          {TOOL_GROUPS.map((grp) => (
            <div key={grp.key} className="flex gap-4">
              {/* sidebar */}
              <div
                className="shrink-0 flex flex-col items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.05] py-3 gap-1.5"
                style={{ width: SIDEBAR_W }}
              >
                <NeonIcon name={grp.key === "folders" ? "FolderOpen" : grp.key === "power" ? "Power" : "Settings"} size={28}>
                  <grp.icon className="h-7 w-7 text-gray-400" />
                </NeonIcon>
                <span className="text-xs text-gray-400 font-medium text-center leading-tight">{t(grp.i18nKey)}</span>
              </div>
              {/* items */}
              <div
                className="flex-1 grid gap-2 items-start"
                style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
              >
                {grp.items.map((tool) => (
                  <button key={tool.key} onClick={() => handleTool(tool)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors group min-w-0 ${
                      tool.danger ? "text-gray-500 hover:text-red-400 hover:bg-red-400/6" : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`} title={t(tool.i18nKey)}>
                    <NeonIcon name={tool.iconName} size={16}>
                      <tool.icon className={`h-4 w-4 shrink-0 transition-colors ${tool.danger ? "group-hover:text-red-400" : "group-hover:text-primary-light"}`} />
                    </NeonIcon>
                    <span className={`truncate ${tool.danger ? "group-hover:text-red-300" : "group-hover:text-gray-200"}`}>{t(tool.i18nKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
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
    </div>
  );
}
