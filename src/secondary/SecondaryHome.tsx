/**
 * Secondary screen home — adaptive mirror panel.
 *
 * Behavior:
 *   - When music is playing: show album art + spectrum + lyrics
 *   - When a movie is playing: show the video (fullscreen)
 *   - Otherwise: show the theme character "living wallpaper" — face + typewriter
 *
 * All data comes from the shared Zustand stores via cross-window IPC.
 */

import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAudioPlayerStore } from "@/stores/audioPlayerStore";
import { useThemeStore, type ThemeName } from "@/stores/themeStore";
import { useThemeShortcutStore } from "@/stores/themeShortcutStore";
import { useTranslation } from "react-i18next";
import { Music, Tv, Monitor } from "lucide-react";

const iceBase = "/themes/ice%20girl";
const cgBase = "/themes/cyber%20girl";

function CharImg({ iconPath, fallbackSrc, className }: { iconPath: string; fallbackSrc: string; className: string }) {
  return <img src={iconPath || fallbackSrc} alt="" className={className}
    onError={(e) => { (e.target as HTMLImageElement).src = fallbackSrc; }} />;
}

export default function SecondaryHome() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const track = useAudioPlayerStore((s) => s.track);
  const visualizerBars = useAudioPlayerStore((s) => s.visualizerBars);
  const { getCharacters } = useThemeShortcutStore();

  const isIce = theme === "ice-girl";
  const isCG = theme === "cyber-girl";
  const isDefault = theme === "default";

  // Typewriter faces for idle state
  const faces = isIce
    ? ["smug", "happy", "angry", "cry", "naughty", "neutral", "surprise", "petty"]
    : isCG
      ? ["talk", "happy", "angry", "neutral"]
      : [];
  const [faceIdx, setFaceIdx] = useState(0);
  useEffect(() => {
    if (faces.length === 0) return;
    const interval = setInterval(() => setFaceIdx(i => (i + 1) % faces.length), 5000);
    return () => clearInterval(interval);
  }, [faces.length]);

  const faceBase = isIce ? iceBase : cgBase;
  const faceSrc = faces.length > 0 ? `${faceBase}/faces/${faces[faceIdx]}.webp` : null;
  const characterChars = getCharacters(theme as "ice-girl" | "cyber-girl");

  return (
    <div className="w-screen h-screen relative bg-[#080c14] flex flex-col items-center justify-center overflow-hidden">
      {/* ── Music Now-Playing ── */}
      {isPlaying && track && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-12">
          {/* Album art */}
          <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ width: "min(50vh, 400px)", height: "min(50vh, 400px)", boxShadow: "0 0 60px rgba(71,136,240,0.2)" }}>
            <img src={track.coverPath || "/themes/ice%20girl/music-cover.webp"} alt="" className="w-full h-full object-cover" />
          </div>

          {/* Track info */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tight">{track.name}</h1>
            <p className="text-xl text-gray-400">{track.artist}{track.album ? ` · ${track.album}` : ""}</p>
          </div>

          {/* Visualizer bars */}
          {visualizerBars && visualizerBars.length > 0 && (
            <div className="flex items-end gap-0.5 h-24" style={{ width: "min(80vw, 600px)" }}>
              {visualizerBars.map((v, i) => {
                const h = Math.max(2, v * 100);
                const hue = 200 + i * 3;
                return (
                  <div key={i} className="flex-1 rounded-t-sm transition-all duration-75"
                    style={{ height: `${h}%`, background: `hsl(${hue}, 80%, 60%)`, opacity: 0.8 }} />
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 text-primary-light/60 text-sm">
            <Music className="h-4 w-4" /> 正在播放
          </div>
        </div>
      )}

      {/* ── Idle / Character Display ── */}
      {!isPlaying && !isDefault && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-16">
          {/* Full-width background video or image */}
          {isIce && (
            <video autoPlay muted loop className="absolute inset-0 w-full h-full object-cover opacity-30"
              src="/themes/ice%20girl/video/bg-loop.mp4" />
          )}

          {/* Character face — large */}
          {faceSrc && (
            <div className="relative z-10 rounded-2xl overflow-hidden"
              style={{ width: "min(40vw, 300px)", height: "min(40vw, 300px)", boxShadow: isIce ? "0 0 40px rgba(135,206,250,0.2)" : "0 0 40px rgba(199,77,255,0.2)" }}>
              <img src={faceSrc} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Character icons row */}
          {characterChars.length > 0 && (
            <div className="relative z-10 flex gap-6 flex-wrap justify-center">
              {characterChars.map((c) => (
                <div key={c.id} className="flex flex-col items-center gap-1">
                  <div className="w-16 h-16 rounded-full border-2 overflow-hidden" style={{ borderColor: `${c.color}60` }}>
                    <CharImg iconPath={c.iconPath} fallbackSrc={`${faceBase}/icons/${c.fileName}`} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{t(c.name)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Default theme idle ── */}
      {!isPlaying && isDefault && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--color-primary) 15%, transparent)" }}>
            <Monitor className="h-12 w-12 text-primary-light/40" />
          </div>
          <h2 className="text-2xl font-bold text-white/30 tracking-tight">Nova Media</h2>
          <p className="text-sm text-gray-600">音乐播放时此屏幕将展示封面与频谱</p>
        </div>
      )}
    </div>
  );
}
