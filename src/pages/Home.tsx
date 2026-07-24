import { useState, useEffect, useRef, useMemo } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  useThemeShortcutStore,
  pickAppFile,
  pickIconFile,
  launchApp,
  type ThemeCharacter,
} from "@/stores/themeShortcutStore";
import { readFileSafe } from "@/lib/readFileSafe";
import ThemeShortcutEditDialog from "@/components/ThemeShortcutEditDialog";
import TypewriterText from "@/components/TypewriterText";
import { onCgSceneChange, CG_SCENES } from "@/components/CyberGirlBgSwitcher";
import { invoke } from "@tauri-apps/api/core";

// Module-level BGM singleton
let _bgmAudio: HTMLAudioElement | null = null;
let _bgmZone: "" | "start" | "main" = "";
const BGM_START = "/sound/cyber%20start.m4a";
const BGM_MAIN = "/sound/cyber.m4a";

function switchBgm(zone: "" | "start" | "main") {
  if (zone === _bgmZone) return;
  if (_bgmAudio) { _bgmAudio.pause(); _bgmAudio = null; }
  _bgmZone = zone;
  if (zone === "") return;
  const src = zone === "start" ? BGM_START : BGM_MAIN;
  _bgmAudio = new Audio(src);
  _bgmAudio.volume = 0.6;
  _bgmAudio.loop = false;
  _bgmAudio.play().catch(() => {});
}

function stopBgm() {
  if (_bgmAudio) { _bgmAudio.pause(); _bgmAudio.currentTime = 0; _bgmAudio = null; }
  _bgmZone = "";
}

import { ThemeAssets, themeUrl } from "@/lib/themeBase";
import { useMovieStore } from "@/stores/movieStore";
import { useImageStore } from "@/stores/imageStore";
import { useGameStore } from "@/stores/gameStore";
import { useMusicStore } from "@/stores/musicStore";
import { usePlayHistoryStore } from "@/stores/playHistoryStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Image, Gamepad2, Clock, Music, Minimize2 } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { useNavigate } from "react-router-dom";
import HomeDashboard from "@/components/HomeDashboard";

// Shared lazy-loaded convertFileSrc
let _cs: ((p: string) => string) | null = null;
let _csLoading = false;
function useCS() {
  const [, setV] = useState(0);
  useEffect(() => {
    if (_cs || _csLoading) return;
    _csLoading = true;
    let cancelled = false;
    (async () => {
      try { const m = await import("@tauri-apps/api/core"); if (!cancelled) { _cs = m.convertFileSrc; setV((v) => v + 1); } } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  return _cs;
}

function CharImg({ iconPath, fallbackSrc, className }: { iconPath: string; fallbackSrc: string; className: string }) {
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);
  function release() { if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; } }
  useEffect(() => () => release(), []);
  useEffect(() => {
    if (!iconPath || iconPath.startsWith("https://nova.localhost/") || iconPath.startsWith("http") || iconPath.startsWith("blob:") || iconPath.startsWith("/themes/")) { release(); setBlobSrc(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await readFileSafe(iconPath); if (cancelled) return;
        const ext = (iconPath.split(".").pop() || "png").toLowerCase();
        const mm: Record<string,string>={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",svg:"image/svg+xml",ico:"image/x-icon",bmp:"image/bmp",gif:"image/gif"};
        const blob = new Blob([data], { type: mm[ext] || "image/png" }); const url = URL.createObjectURL(blob);
        if (!cancelled) { release(); blobRef.current = url; setBlobSrc(url); } else URL.revokeObjectURL(url);
      } catch { if (!cancelled) setBlobSrc(null); }
    })();
    return () => { cancelled = true; };
  }, [iconPath]);
  const display = blobSrc || (iconPath && (iconPath.startsWith("/themes/") || iconPath.startsWith("https://nova.localhost/")) ? iconPath : null) || fallbackSrc;
  return <img src={display} alt="" className={className} onError={(e) => { const el = e.target as HTMLImageElement; if (el.src !== fallbackSrc) el.src = fallbackSrc; }} />;
}

/** Switches between full dashboard and compact MediaStrip */
function DashBoardOrStrip() {
  const mode = useSettingsStore((s) => s.dashboardMode);
  if (mode === "full") return <HomeDashboard />;
  return null; // MediaStrip is rendered in Layout.tsx at the bottom
}

type ThemeType = "story" | "dynamic" | "static" | "hybrid";

const THEME_META: Record<string, { type: ThemeType }> = {
  default:     { type: "static" },
  "ice-girl":  { type: "dynamic" },
  "cyber-girl":{ type: "story" },
};

function getThemeMeta(theme: string) {
  return THEME_META[theme] ?? THEME_META.default;
}

function CgSkillShowcase({ t, cgSceneIdx, textClass, textColor }: { t: any; cgSceneIdx: number; textClass: string; textColor: string }) {
  const skills = [
    { src: ThemeAssets.cg.scene("skill-show-music.webp"), corner: "tl" as const, labelKey: "nav.music" },
    { src: ThemeAssets.cg.scene("skill-show-movie.webp"), corner: "tr" as const, labelKey: "nav.movies" },
    { src: ThemeAssets.cg.scene("skill-show-image.webp"), corner: "bl" as const, labelKey: "nav.images" },
    { src: ThemeAssets.cg.scene("skill-show-game.webp"),  corner: "br" as const, labelKey: "nav.games" },
  ];
  return (
    <div className="relative w-full flex flex-col items-center gap-3" style={{ paddingTop: "min(6vh, 40px)" }}>
      {/* Face + typewriter — centered header */}
      <div className="flex flex-col items-center" style={{ pointerEvents: "none" }}>
        <div className="rounded-2xl overflow-hidden shrink-0" style={{ width: 80, height: 80, boxShadow: "0 0 25px rgba(199,77,255,0.25), 0 0 50px rgba(255,77,166,0.1)" }}>
          <img src={ThemeAssets.cg.face("happy")} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div className="cg-scroll theme-card rounded-lg px-4 py-2.5 mt-3" style={{ maxWidth: "480px", minWidth: "200px" }}>
          <CgTypewriter key={`cg-skill-${cgSceneIdx}`} text={t(`home.cg_scene${cgSceneIdx + 1}_text`)} speed={50} className={cn(textClass, "text-center")} style={{ color: textColor }} />
        </div>
      </div>

      {/* Skill images — 2×2 grid centered below */}
      <div
        className="flex flex-wrap justify-center gap-3 w-full max-w-[640px]"
        style={{ pointerEvents: "none" }}
      >
        {skills.map((sk, i) => (
          <div key={sk.src} className="rounded-xl overflow-hidden animate-fade-in-up" style={{
            width: "clamp(160px, 22%, 240px)",
            boxShadow: "0 0 20px rgba(199,77,255,0.2), 0 0 40px rgba(255,77,166,0.08)",
            animationDelay: `${i * 0.12 + 0.2}s`,
          }}>
            <img src={sk.src} alt="" className="w-full h-auto block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CgTypewriter({ text, speed = 55, delay = 0, className, style }: { text: string; speed?: number; delay?: number; className?: string; style?: React.CSSProperties }) {
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!text) return;
    setDisplayed(""); setTyping(false);
    const startTimer = setTimeout(() => {
      setTyping(true);
      let idx = 0;
      const interval = setInterval(() => {
        idx++;
        if (idx > text.length) { clearInterval(interval); setTyping(false); }
        else setDisplayed(text.slice(0, idx));
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [text, speed, delay]);
  return <p className={className} style={style}>{displayed || " "}{typing && <span className="inline-block w-0.5 h-3.5 bg-[#e890ff]/60 ml-0.5 align-middle animate-pulse" />}</p>;
}

/** Load manifest.script from Rust for premium themes */
interface RuntimeScriptNode { id: string; label: string; background: string; face: string; text: string; bgm: string; skillShow: boolean; thumbOk: boolean; thumbUrl: string; faceOk: boolean; faceUrl: string; i18nPreview: string; }
function useThemeScript(theme: string) {
  const [script, setScript] = useState<RuntimeScriptNode[]>([]);
  useEffect(() => {
    setScript([]); // 立即清除旧主题数据
    if (theme === "default") return;
    let cancelled = false;
    invoke<RuntimeScriptNode[]>("theme_get_script", { themeId: theme })
      .then(s => { if (!cancelled) setScript(s); })
      .catch(() => { if (!cancelled) setScript([]); });
    return () => { cancelled = true; };
  }, [theme]);
  return script;
}

export default function Home() {
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const { getCharacters, saveOverride, resetCharacter } = useThemeShortcutStore();
  const themeType = getThemeMeta(theme).type;

  // Preload all media stores so Dashboard counts show immediately
  const loadMovies = useMovieStore((s) => s.loadMovies);
  const loadImages = useImageStore((s) => s.loadImages);
  const loadMusic = useMusicStore((s) => s.loadMusic);
  const loadGames = useGameStore((s) => s.loadGames);
  useEffect(() => {
    if (themeType === "static") {
      loadMovies(); loadImages(); loadMusic(); loadGames();
      usePlayHistoryStore.getState().init();
    }
  }, [themeType]);
  const script = useThemeScript(theme);
  const [editingChar, setEditingChar] = useState<ThemeCharacter | null>(null);
  const [iceBgVisible, setIceBgVisible] = useState(false);
  const [iceFace, setIceFace] = useState("");
  const [cgSceneIdx, setCgSceneIdx] = useState(0);

  // 主题切换时重置状态
  useEffect(() => {
    setIceBgVisible(false);
    setIceFace("");
    setCgSceneIdx(0);
  }, [theme]);

  // Build dynamic quotes from script
  const dynamicQuotes = useMemo(() => (themeType === "dynamic" ? script.map(node => ({
    text: node.text.startsWith("home.") ? t(node.text) : node.text,
    face: node.face,
  })) : []), [script, themeType, t]);

  useEffect(() => {
    if (themeType !== "story") return;
    return onCgSceneChange(setCgSceneIdx);
  }, [themeType]);

  const cyberBgmEnabled = useSettingsStore((s) => s.cyberBgmEnabled);
  const cgTextSize = useSettingsStore((s) => s.cgTextSize);
  const cgTextColor = useSettingsStore((s) => s.cgTextColor);
  const cgTextBgColor = useSettingsStore((s) => s.cgTextBgColor);
  const cgTextBgOpacity = useSettingsStore((s) => s.cgTextBgOpacity);
  const cgTextClass = `text-${cgTextSize} tracking-wide leading-relaxed`;
  const cgScrollBgStyle = { background: `color-mix(in srgb, ${cgTextBgColor} ${cgTextBgOpacity}%, transparent)` };

  // BGM driven by script node bgm field
  useEffect(() => {
    if (themeType !== "story" || !cyberBgmEnabled) { stopBgm(); return; }
    const node = script[cgSceneIdx];
    if (node?.bgm) switchBgm(node.bgm as "start" | "main");
    else if (cgSceneIdx <= 4) switchBgm("start");
    else switchBgm("main");
  }, [themeType, cgSceneIdx, cyberBgmEnabled, script]);
  useEffect(() => { return () => { stopBgm(); }; }, [themeType]);

  const handleCharClick = (c: ThemeCharacter) => { if (c.appPath) launchApp(c.appPath); };
  const handleCharContext = (e: React.MouseEvent, c: ThemeCharacter) => { e.preventDefault(); setEditingChar(c); };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── Static: Dashboard or compact strip ── */}
      {themeType === "static" && <DashBoardOrStrip />}

      {/* ── Dynamic: script-driven typewriter + skill icons ── */}
      {themeType === "dynamic" && dynamicQuotes.length > 0 && (
        <div className="mt-12 pt-8" data-hero>
          {/* Typewriter lore */}
          <div className="flex items-end justify-center gap-4 mb-6" style={{ opacity: iceBgVisible ? 1 : 0, transition: "opacity 0.6s ease" }}>
            {iceFace && (
              <div className="shrink-0 rounded-2xl overflow-hidden" style={{ boxShadow: "0 0 18px rgba(176,224,255,0.18), 0 0 45px rgba(176,224,255,0.06)" }}>
                {iceFace.startsWith("video:") ? (
                  <video src={ThemeAssets.ice.video(iceFace.slice(6))} autoPlay muted playsInline onEnded={(e) => e.currentTarget.pause()} style={{ width: "240px", height: "auto" }} />
                ) : (
                  <img src={ThemeAssets.ice.face(iceFace)} alt="" style={{ width: "144px", height: "144px", imageRendering: "auto" }} />
                )}
              </div>
            )}
            <div className="ice-scroll theme-card rounded-lg p-5 text-center max-w-xl">
              <TypewriterText quotes={dynamicQuotes} speed={70} pause={1000} onVisibilityChange={setIceBgVisible} onFaceChange={setIceFace}
                className="text-xs text-[#b0e0ff] tracking-wide leading-relaxed" />
            </div>
          </div>
          {/* Skill icons */}
          <div className="theme-card mx-auto inline-flex rounded-2xl px-5 py-3.5">
          <div className="flex justify-center gap-8 flex-wrap">
            {getCharacters("ice-girl").map((exile) => (
              <div key={exile.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => handleCharClick(exile)} onContextMenu={(e) => handleCharContext(e, exile)}>
                <div className="flex h-14 w-14 rounded-full border-2 overflow-hidden transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(176,224,255,0.3)]" style={{borderColor:`${exile.color}60`,boxShadow:`0 0 10px ${exile.color}30`}}>
                  <CharImg iconPath={exile.iconPath} fallbackSrc={themeUrl("ice-girl", `icons/${exile.fileName}`)} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-center"><span className="text-xs tracking-[0.12em] uppercase font-semibold group-hover:text-[#b0e0ff] transition-colors" style={{color:"#c8e6ff"}}>{t(exile.name)}</span><p className="text-[10px] tracking-[0.15em] uppercase group-hover:text-white transition-colors mt-0.5" style={{color:"#b0e0ff"}}>{t(exile.subtitle)}</p></div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* ── Story: script-driven scene progression ── */}
      {themeType === "story" && (
        <div className="mt-12 pt-8" data-hero>
          {(() => {
            const node = script[cgSceneIdx];
            if (!node) return null;
            const faceUrl = node.face && node.faceOk ? node.faceUrl : undefined;
            const displayText = node.text.startsWith("home.") ? t(node.text) : node.text;

            if (node.skillShow) {
              return <CgSkillShowcase key={cgSceneIdx} t={t} cgSceneIdx={cgSceneIdx} textClass={cgTextClass} textColor={cgTextColor} />;
            }

            return (
              <div className="flex items-end justify-center gap-4 mb-8">
                {faceUrl && (
                  <div className="shrink-0 rounded-2xl overflow-hidden" style={{ boxShadow: "0 0 20px rgba(199,77,255,0.2), 0 0 45px rgba(255,77,166,0.08)" }}>
                    <img src={faceUrl} alt="" style={{ width: "144px", height: "144px", objectFit: "cover" }} />
                  </div>
                )}
                <div className="cg-scroll theme-card rounded-lg p-5 text-center max-w-xl">
                  <CgTypewriter key={cgSceneIdx} text={displayText} speed={55} className={cgTextClass} style={{ color: cgTextColor }} />
                </div>
              </div>
            );
          })()}
          {/* Skill icons */}
          <div className="theme-card mx-auto inline-flex rounded-2xl px-5 py-3.5">
          <div className="flex justify-center gap-8 flex-wrap">
            {getCharacters("cyber-girl").map((c) => (
              <div key={c.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => handleCharClick(c)} onContextMenu={(e) => handleCharContext(e, c)}>
                <div className="flex h-14 w-14 rounded-full border-2 overflow-hidden transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(199,77,255,0.35),0_0_40px_rgba(255,77,166,0.15)]" style={{borderColor:`${c.color}60`,boxShadow:`0 0 10px ${c.color}30`}}>
                  <CharImg iconPath={c.iconPath} fallbackSrc={themeUrl("cyber-girl", `icons/${c.fileName}`)} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-center"><span className="text-xs tracking-[0.12em] uppercase font-semibold group-hover:text-[#e890ff] transition-colors" style={{color:"#e0c0ff"}}>{t(c.name)}</span><p className="text-[10px] tracking-[0.15em] uppercase group-hover:text-[#00bfff] transition-colors mt-0.5" style={{color:"#c0a0e0"}}>{t(c.subtitle)}</p></div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      <ThemeShortcutEditDialog open={!!editingChar} character={editingChar} onClose={() => setEditingChar(null)} onSave={saveOverride} onReset={resetCharacter} onPickApp={pickAppFile} onPickIcon={pickIconFile} />
    </div>
  );
}
