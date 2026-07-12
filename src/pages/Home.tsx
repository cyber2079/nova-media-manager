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

import { useMovieStore } from "@/stores/movieStore";
import { useImageStore } from "@/stores/imageStore";
import { useGameStore } from "@/stores/gameStore";
import { useMusicStore } from "@/stores/musicStore";
import { usePlayHistoryStore } from "@/stores/playHistoryStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Film, Image, Gamepad2, Tag, Clock, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";

const iceBase = "/themes/ice%20girl";
const cgBase = "/themes/cyber%20girl";

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
    if (!iconPath || iconPath.startsWith("/themes/") || iconPath.startsWith("http") || iconPath.startsWith("blob:")) { release(); setBlobSrc(null); return; }
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
  const display = blobSrc || (iconPath && iconPath.startsWith("/themes/") ? iconPath : null) || fallbackSrc;
  return <img src={display} alt="" className={className} onError={(e) => { const el = e.target as HTMLImageElement; if (el.src !== fallbackSrc) el.src = fallbackSrc; }} />;
}

function DashBoard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const movies = useMovieStore((s) => s.movies);
  const images = useImageStore((s) => s.images);
  const games = useGameStore((s) => s.games);
  const musicCount = useMusicStore((s) => s.music.length);
  const recentPlays = usePlayHistoryStore((s) => s.recent);

  const stats = useMemo(() => [
    { key: "movies", icon: Film, count: movies.length, cssColor: "var(--color-primary)", to: "/movies" },
    { key: "images", icon: Image, count: images.length, cssColor: "var(--color-accent)", to: "/images" },
    { key: "music", icon: Music, count: musicCount, cssColor: "var(--color-primary-light)", to: "/music" },
    { key: "games", icon: Gamepad2, count: games.length, cssColor: "var(--color-primary-dark)", to: "/games" },
  ], [movies.length, images.length, musicCount, games.length]);

  const recent = useMemo(() => {
    const items: { name: string; type: string; time: string; cssColor: string }[] = [];
    movies.slice(-4).reverse().forEach((m) => items.push({ name: m.name, type: t("dashboard.movies"), time: m.addTime, cssColor: "var(--color-primary)" }));
    images.slice(-4).reverse().forEach((i) => items.push({ name: i.name, type: t("dashboard.images"), time: (i as any).addTime || "", cssColor: "var(--color-accent)" }));
    games.slice(-4).reverse().forEach((g) => items.push({ name: g.name, type: t("dashboard.games"), time: g.addTime, cssColor: "var(--color-primary-light)" }));
    return items.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);
  }, [movies, images, games, t]);

  const tags = useMemo(() => {
    const tc = new Map<string, number>();
    movies.forEach((m) => m.tags.forEach((tg) => tc.set(tg, (tc.get(tg) || 0) + 1)));
    images.forEach((i) => (i.tags || []).forEach((tg) => tc.set(tg, (tc.get(tg) || 0) + 1)));
    games.forEach((g) => (g.tags || []).forEach((tg) => tc.set(tg, (tc.get(tg) || 0) + 1)));
    return Array.from(tc.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [movies, images, games]);

  const total = movies.length + images.length + musicCount + games.length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 p-5 sm:p-6" style={{ background: "color-mix(in srgb, var(--color-primary) 4%, #080c14)" }}>
        <p className="inline-block rounded-full border border-primary/30 px-3 py-1 text-xs text-primary-light">
          {t("home.total_count", { count: total })}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <button key={s.key} onClick={() => navigate(s.to)}
            className="group relative overflow-hidden rounded-xl border border-primary/20 p-4 sm:p-5 text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
            style={{ background: "color-mix(in srgb, var(--color-primary) 6%, #101520)" }}>
            <div className="absolute top-0 right-0 w-16 h-16 opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: `radial-gradient(circle at center, ${s.cssColor}, transparent 70%)` }} />
            <s.icon className="h-5 w-5 sm:h-6 sm:w-6 mb-2 sm:mb-3" style={{ color: s.cssColor, filter: "brightness(1.3)" }} />
            <p className="text-xl sm:text-2xl font-bold text-white">{s.count}</p>
            <p className="text-[11px] sm:text-xs text-[#9ab8d4] mt-0.5 sm:mt-1">{t(`nav.${s.key}`)}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold text-[#9ab8d4] uppercase tracking-wider mb-3">{t("dashboard.recent")}</h3>
          {recent.length > 0 ? (
            <div className="space-y-1">
              {recent.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-lighter/50 transition-colors group cursor-default">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.cssColor, filter: "brightness(1.3)" }} />
                  <span className="flex-1 text-sm text-[#c8ddf0] truncate">{item.name}</span>
                  <span className="text-[10px] text-[#8aa8c4] shrink-0">{item.type}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[#8aa8c4]">{t("dashboard.empty")}</p>}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[#9ab8d4] uppercase tracking-wider mb-3">{t("dashboard.popular_tags")}</h3>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map(([tag, count]) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs border transition-all hover:scale-105 cursor-default" style={{
                  backgroundColor: `color-mix(in srgb, ${tagCssColor(tag)} 20%, #101520)`,
                  borderColor: `color-mix(in srgb, ${tagCssColor(tag)} 40%, #1a1f2a)`,
                  color: tagCssColor(tag),
                }}><Tag className="h-2.5 w-2.5" />{tag}<span className="opacity-50 ml-0.5">{count}</span></span>
              ))}
            </div>
          ) : <p className="text-sm text-[#8aa8c4]">{t("dashboard.no_tags")}</p>}
        </div>
      </div>

      {recentPlays.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#9ab8d4] uppercase tracking-wider mb-3 flex items-center gap-2"><Clock className="h-3.5 w-3.5" style={{ color: "var(--color-primary-light)", filter: "brightness(1.3)" }} />{t("music.recent_plays")}</h3>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {recentPlays.slice(0, 8).map((e, i) => (
              <div key={e.id + i} className="flex items-center gap-2 shrink-0 rounded-lg border border-primary/20 px-3 py-2 text-sm cursor-pointer hover:bg-surface-lighter/50 transition-colors"
                style={{ background: "color-mix(in srgb, var(--color-primary) 6%, #101520)" }}
                onClick={() => navigate(e.type === "movie" ? "/movies" : "/music")}>
                {e.type === "movie" ? <Film className="h-3.5 w-3.5" style={{ color: "var(--color-primary)", filter: "brightness(1.3)" }} /> : <Music className="h-3.5 w-3.5" style={{ color: "var(--color-accent)", filter: "brightness(1.3)" }} />}
                <span className="text-[#c8ddf0] truncate max-w-[120px]">{e.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function tagCssColor(str: string): string {
  const vars = ["var(--color-primary)", "var(--color-primary-light)", "var(--color-accent)", "var(--color-primary-dark)"];
  let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return vars[Math.abs(h) % vars.length];
}

function ThemeTitle() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const isIce = theme === "ice-girl";
  const isCG = theme === "cyber-girl";
  const k = isIce ? "home.ice" : isCG ? "home.cg" : "home.ice";
  const title = t(`${k}_title`);
  const subtitle = t(`${k}_subtitle`);
  return (<>
    {title && <h1 className={cn("font-bold theme-enter-title", isIce && "text-6xl font-black tracking-[0.1em] ice-text-glow text-[#b0e0ff] uppercase", isCG && "text-5xl font-black tracking-[0.1em] cg-text-glow text-[#e890ff] uppercase")}>{title}</h1>}
    {subtitle && <p className={cn(title && "mt-3", isIce && "text-xl font-semibold tracking-[0.25em] text-[#87ceeb]/70 uppercase", isCG && "text-xl font-semibold tracking-[0.2em] text-[#ff4da6]/70 uppercase")}>{subtitle}</p>}
  </>);
}

function CgSkillShowcase({ cgBase, t, cgSceneIdx, textClass, textColor, bgStyle }: { cgBase: string; t: any; cgSceneIdx: number; textClass: string; textColor: string; bgStyle: React.CSSProperties }) {
  const skills = [
    { src: "start2-listen song.webp", corner: "tl" as const, labelKey: "nav.music" },
    { src: "start2-watch movie.webp", corner: "tr" as const, labelKey: "nav.movies" },
    { src: "start2-view pic.webp",   corner: "bl" as const, labelKey: "nav.images" },
    { src: "start2-play game.webp",  corner: "br" as const, labelKey: "nav.games" },
  ];
  return (
    <div className="relative w-full" style={{ height: "min(58vh, 520px)", minHeight: "360px" }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ pointerEvents: "none" }}>
        <div className="rounded-2xl overflow-hidden shrink-0" style={{ width: 100, height: 100, boxShadow: "0 0 25px rgba(199,77,255,0.25), 0 0 50px rgba(255,77,166,0.1)" }}>
          <img src={`${cgBase}/pic/happy face.webp`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div className="cg-scroll rounded-lg px-5 py-3 mt-4" style={{ maxWidth: "520px", width: "fit-content", minWidth: "220px", ...bgStyle }}>
          <CgTypewriter key={`cg-skill-${cgSceneIdx}`} text={t(`home.cg_scene${cgSceneIdx + 1}_text`)} speed={50} className={cn(textClass, "text-center")} style={{ color: textColor }} />
        </div>
      </div>
      {skills.map((sk, i) => (
        <div key={sk.src} className="absolute rounded-xl overflow-hidden" style={{
          ...(sk.corner === "tl" ? { top: "2%", left: "2%" } : sk.corner === "tr" ? { top: "2%", right: "2%" } : sk.corner === "bl" ? { bottom: "2%", left: "2%" } : { bottom: "2%", right: "2%" }),
          width: "clamp(200px, 30%, 300px)",
          boxShadow: "0 0 20px rgba(199,77,255,0.2), 0 0 40px rgba(255,77,166,0.08)",
          animation: `cg-swoop-${sk.corner} 0.5s cubic-bezier(0.22,0.61,0.36,1) ${i * 0.08 + 0.2}s both`,
        }}><img src={`${cgBase}/pic/${sk.src}`} alt="" className="w-full h-auto block" /></div>
      ))}
    </div>
  );
}

function CgTypewriter({ text, speed = 55, delay = 0, className }: { text: string; speed?: number; delay?: number; className?: string }) {
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
  return <p className={className}>{displayed || " "}{typing && <span className="inline-block w-0.5 h-3.5 bg-[#e890ff]/60 ml-0.5 align-middle animate-pulse" />}</p>;
}

export default function Home() {
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const { getCharacters, saveOverride, resetCharacter } = useThemeShortcutStore();
  const isIce = theme === "ice-girl";
  const isCG = theme === "cyber-girl";
  const [editingChar, setEditingChar] = useState<ThemeCharacter | null>(null);
  const [iceBgVisible, setIceBgVisible] = useState(false);
  const [iceFace, setIceFace] = useState("");
  const [cgSceneIdx, setCgSceneIdx] = useState(0);

  useEffect(() => {
    if (!isCG) return;
    return onCgSceneChange(setCgSceneIdx);
  }, [isCG]);

  const cyberBgmEnabled = useSettingsStore((s) => s.cyberBgmEnabled);
  const cgTextSize = useSettingsStore((s) => s.cgTextSize);
  const cgTextColor = useSettingsStore((s) => s.cgTextColor);
  const cgTextBgColor = useSettingsStore((s) => s.cgTextBgColor);
  const cgTextBgOpacity = useSettingsStore((s) => s.cgTextBgOpacity);
  const cgTextClass = `text-${cgTextSize} tracking-wide leading-relaxed`;
  const cgScrollBgStyle = { background: `color-mix(in srgb, ${cgTextBgColor} ${cgTextBgOpacity}%, transparent)` };

  useEffect(() => {
    if (!isCG || !cyberBgmEnabled) { stopBgm(); return; }
    if (cgSceneIdx <= 4) switchBgm("start");
    else switchBgm("main");
  }, [isCG, cgSceneIdx, cyberBgmEnabled]);
  useEffect(() => { return () => { stopBgm(); }; }, [isCG]);

  const handleCharClick = (c: ThemeCharacter) => { if (c.appPath) launchApp(c.appPath); };
  const handleCharContext = (e: React.MouseEvent, c: ThemeCharacter) => { e.preventDefault(); setEditingChar(c); };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Theme Title */}
      <div className="text-center"><ThemeTitle /></div>

      {/* ── Ice Girl Section ── */}
      {isIce && (
        <div className="mt-12 pt-8" data-hero>
          {/* Typewriter lore */}
          <div className="flex items-end justify-center gap-4 mb-6" style={{ opacity: iceBgVisible ? 1 : 0, transition: "opacity 0.6s ease" }}>
            {iceFace && (
              <div className="shrink-0 rounded-2xl overflow-hidden" style={{ boxShadow: "0 0 18px rgba(176,224,255,0.18), 0 0 45px rgba(176,224,255,0.06)" }}>
                {iceFace.startsWith("video:") ? (
                  <video src={`/themes/ice%20girl/pic/${iceFace.slice(6)}.mp4`} autoPlay muted playsInline onEnded={(e) => e.currentTarget.pause()} style={{ width: "240px", height: "auto" }} />
                ) : (
                  <img src={`/themes/ice%20girl/pic/${iceFace} face.webp`} alt="" style={{ width: "144px", height: "144px", imageRendering: "auto" }} />
                )}
              </div>
            )}
            <div className="ice-scroll rounded-lg p-5 text-center max-w-xl">
              <TypewriterText quotes={[
                { text: t("home.ice_ascendancy_text"), face: "lofty" },
                { text: t("home.ice_quote_1"), face: "happy" },
                { text: t("home.ice_quote_2"), face: "angry" },
                { text: t("home.ice_quote_3"), face: "lofty" },
                { text: t("home.ice_quote_4"), face: "angry" },
                { text: t("home.ice_quote_5"), face: "happy" },
                { text: t("home.ice_quote_7"), face: "lofty" },
                { text: t("home.ice_quote_8"), face: "angry" },
                { text: t("home.ice_quote_9"), face: "angry" },
                { text: t("home.ice_quote_10"), face: "angry" },
                { text: t("home.ice_quote_11"), face: "happy" },
                { text: t("home.ice_quote_12"), face: "angry" },
                { text: t("home.ice_quote_13"), face: "angry" },
                { text: t("home.ice_quote_14"), face: "cry" },
                { text: t("home.ice_quote_15"), face: "angry" },
                { text: t("home.ice_quote_16"), face: "naughty" },
                { text: t("home.ice_quote_17"), face: "video:secretary" },
              ]} speed={70} pause={1000} onVisibilityChange={setIceBgVisible} onFaceChange={setIceFace}
                className="text-xs text-[#b0e0ff] tracking-wide leading-relaxed" />
            </div>
          </div>
          {/* Skill icons */}
          <div className="mx-auto inline-flex rounded-2xl px-5 py-3.5" style={{ background: "color-mix(in srgb, #87ceeb 8%, transparent)", border: "1px solid color-mix(in srgb, #87ceeb 18%, transparent)" }}>
          <div className="flex justify-center gap-8 flex-wrap">
            {getCharacters("ice-girl").map((exile) => (
              <div key={exile.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => handleCharClick(exile)} onContextMenu={(e) => handleCharContext(e, exile)}>
                <div className="flex h-14 w-14 rounded-full border-2 overflow-hidden transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(176,224,255,0.3)]" style={{borderColor:`${exile.color}60`,boxShadow:`0 0 10px ${exile.color}30`}}>
                  <CharImg iconPath={exile.iconPath} fallbackSrc={`${iceBase}/icons/${exile.fileName}`} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-center"><span className="text-xs tracking-[0.12em] uppercase font-semibold group-hover:text-[#b0e0ff] transition-colors" style={{color:"#c8e6ff"}}>{t(exile.name)}</span><p className="text-[10px] tracking-[0.15em] uppercase group-hover:text-white transition-colors mt-0.5" style={{color:"#b0e0ff"}}>{t(exile.subtitle)}</p></div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* ── Cyber Girl Section ── */}
      {isCG && (
        <div className="mt-12 pt-8" data-hero>
          {CG_SCENES[cgSceneIdx]?.skillShow ? (
            <CgSkillShowcase key={cgSceneIdx} cgBase={cgBase} t={t} cgSceneIdx={cgSceneIdx} textClass={cgTextClass} textColor={cgTextColor} bgStyle={cgScrollBgStyle} />
          ) : (
            <div className="flex items-end justify-center gap-4 mb-8">
              {CG_SCENES[cgSceneIdx] && (
                <div className="shrink-0 rounded-2xl overflow-hidden" style={{ boxShadow: "0 0 20px rgba(199,77,255,0.2), 0 0 45px rgba(255,77,166,0.08)" }}>
                  <img src={`${cgBase}/pic/${CG_SCENES[cgSceneIdx].face}`} alt="" style={{ width: "144px", height: "144px", objectFit: "cover" }} />
                </div>
              )}
              <div className="cg-scroll rounded-lg p-5 text-center max-w-xl" style={cgScrollBgStyle}>
                <CgTypewriter key={cgSceneIdx} text={t(`home.cg_scene${cgSceneIdx + 1}_text`)} speed={55} className={cgTextClass} style={{ color: cgTextColor }} />
              </div>
            </div>
          )}
          {/* Skill icons */}
          <div className="mx-auto inline-flex rounded-2xl px-5 py-3.5" style={{ background: "color-mix(in srgb, #c74dff 8%, transparent)", border: "1px solid color-mix(in srgb, #c74dff 18%, transparent)" }}>
          <div className="flex justify-center gap-8 flex-wrap">
            {getCharacters("cyber-girl").map((c) => (
              <div key={c.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => handleCharClick(c)} onContextMenu={(e) => handleCharContext(e, c)}>
                <div className="flex h-14 w-14 rounded-full border-2 overflow-hidden transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(199,77,255,0.35),0_0_40px_rgba(255,77,166,0.15)]" style={{borderColor:`${c.color}60`,boxShadow:`0 0 10px ${c.color}30`}}>
                  <CharImg iconPath={c.iconPath} fallbackSrc={`${cgBase}/icons/${c.fileName}`} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
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
