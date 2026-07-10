import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Film, Image, Gamepad2, Home, Music, Sun, Sword, Shield, Swords, Maximize2, Minimize2, Search, Settings, Globe, Sparkles, Play, Pause, SkipBack, SkipForward, SlidersHorizontal, X, Volume2, VolumeX } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/utils";
import { kv } from "@/lib/sqliteStore";
import { useThemeStore, type ThemeName } from "@/stores/themeStore";
import { useTranslation } from "react-i18next";
import { languages } from "@/i18n";
import QuickLaunchBar from "@/components/QuickLaunchBar";
import SettingsDialog from "@/components/SettingsDialog";
import GlobalSearch from "@/components/GlobalSearch";
import KeyboardHelp from "@/components/KeyboardHelp";
import { useSettingsStore, computeThemeColors, fontSizeScale, iconSizeScale, applySurface, applyFontFamily } from "@/stores/settingsStore";
import { useAudioPlayerStore, fmtTime } from "@/stores/audioPlayerStore";
import { useWidgetStore } from "@/stores/widgetStore";
import MyComputerWidget from "@/components/widgets/MyComputerWidget";
import SystemMonitorWidget from "@/components/widgets/SystemMonitorWidget";
import ClockWidget from "@/components/widgets/ClockWidget";
import CalendarWidget from "@/components/widgets/CalendarWidget";
import CountdownWidget from "@/components/widgets/CountdownWidget";
import ScrollFade from "@/components/ScrollFade";
import CountdownAlert from "@/components/CountdownAlert";
import ActivationDialog from "@/components/ActivationDialog";
import PrivacyConsent from "@/components/PrivacyConsent";
import BgVideoTuner from "@/components/BgVideoTuner";
import CyberGirlBgSwitcher from "@/components/CyberGirlBgSwitcher";
import CyberParticles from "@/components/CyberParticles";
import CyberPcbBackground from "@/components/CyberPcbBackground";
import UpdateChecker from "@/components/UpdateChecker";
import { useLicenseStore } from "@/stores/licenseStore";
import { analytics, useAnalyticsPageView } from "@/lib/analytics";

const navItems = [
  { to: "/", key: "home", icon: Home },
  { to: "/movies", key: "movies", icon: Film },
  { to: "/images", key: "images", icon: Image },
  { to: "/music", key: "music", icon: Music },
  { to: "/games", key: "games", icon: Gamepad2 },
];

// Default theme nav icons
const defaultIcons: Record<string, string> = { "/": "home.svg", "/movies": "movie.svg", "/images": "pic.svg", "/music": "music.svg", "/games": "game.svg" };

const ff7Icons: Record<string, string> = { "/": "cloud.webp", "/movies": "sephiroth.webp", "/images": "aerith.webp", "/music": "tifa.webp", "/games": "barret.webp" };
const ff7Names: Record<string, string> = { "/": "Cloud", "/movies": "Sephiroth", "/images": "Aerith", "/music": "Tifa", "/games": "Barret" };
const ff7Colors: Record<string, string> = { "/": "#4488ff", "/movies": "#00e5a0", "/images": "#ff88cc", "/music": "#ff88cc", "/games": "#e6b422" };

const owIcons: Record<string, string> = { "/": "PI_Cute_Tracer.webp", "/movies": "PI_Cute_D.Va.webp", "/images": "PI_Cute_Sombra.webp", "/music": "PI_Cute_Lucio.webp", "/games": "PI_Cute_Genji.webp" };
const owNames: Record<string, string> = { "/": "Tracer", "/movies": "D.Va", "/images": "Sombra", "/music": "Lucio", "/games": "Genji" };
const owColors: Record<string, string> = { "/": "#f99e1a", "/movies": "#f99e1a", "/images": "#218ffe", "/music": "#f99e1a", "/games": "#218ffe" };
const owLabels: Record<string, string> = { "/": "Recall", "/movies": "Nerf This!", "/images": "Hack", "/music": "Soundwave", "/games": "Dragonblade" };

const giIcons: Record<string, string> = { "/": "1.webp", "/movies": "2.webp", "/images": "3.webp", "/music": "5.webp", "/games": "4.webp" };
const giNames: Record<string, string> = { "/": "Venti", "/movies": "Diluc", "/images": "Ganyu", "/music": "Xiao", "/games": "Zhongli" };
const giColors: Record<string, string> = { "/": "#5b8c5a", "/movies": "#e06040", "/images": "#87ceeb", "/music": "#5b8c5a", "/games": "#d4a84b" };
const giLabels: Record<string, string> = { "/": "Venti", "/movies": "Diluc", "/images": "Ganyu", "/music": "Xiao", "/games": "Zhongli" };

const poeIcons: Record<string, string> = { "/": "home.webp", "/movies": "movie.webp", "/images": "pic.webp", "/music": "music.webp", "/games": "game.webp" };
const poeNames: Record<string, string> = { "/": "Ice Storm", "/movies": "Arctic Armour", "/images": "Frost Wall", "/music": "Ice Nova", "/games": "Comet" };
const poeColors: Record<string, string> = { "/": "#87ceeb", "/movies": "#b0e0e6", "/images": "#00bfff", "/music": "#4488ff", "/games": "#6a5acd" };
const poeLabels: Record<string, string> = { "/": "Ice Storm", "/movies": "Arctic Armour", "/images": "Frost Wall", "/music": "Ice Nova", "/games": "Comet" };

const cs2Icons: Record<string, string> = { "/": "crosshair.svg", "/movies": "ak47.svg", "/images": "awp.svg", "/music": "shield.svg", "/games": "bomb.svg" };
const cs2Names: Record<string, string> = { "/": "SAS", "/movies": "Phoenix", "/images": "FBI", "/music": "GIGN", "/games": "Elite Crew" };
const cs2Colors: Record<string, string> = { "/": "#4a90d9", "/movies": "#de6d1c", "/images": "#4a90d9", "/music": "#4a90d9", "/games": "#cc4444" };
const cs2Labels: Record<string, string> = { "/": "Counter-Terrorist", "/movies": "Terrorist", "/images": "Counter-Terrorist", "/music": "Counter-Terrorist", "/games": "Terrorist" };

const pgIcons: Record<string, string> = { "/": "home.webp", "/movies": "movie.webp", "/images": "pic.webp", "/music": "music.webp", "/games": "game.webp" };
const pgNames: Record<string, string> = { "/": "Dance", "/movies": "Fly", "/images": "Heart", "/music": "Arrow", "/games": "Pray" };
const pgColors: Record<string, string> = { "/": "#ff69b4", "/movies": "#da70d6", "/images": "#ff1493", "/music": "#c71585", "/games": "#db7093" };
const pgLabels: Record<string, string> = { "/": "Dance", "/movies": "Fly", "/images": "Heart", "/music": "Arrow", "/games": "Pray" };

const bwIcons: Record<string, string> = { "/": "home.webp", "/movies": "movie.webp", "/images": "pic.webp", "/music": "music.webp", "/games": "game.webp" };
const bwNames: Record<string, string> = { "/": "Monochrome", "/movies": "Noir", "/images": "Contrast", "/music": "Rhythm", "/games": "Shadow" };
const bwColors: Record<string, string> = { "/": "#c8c8d0", "/movies": "#b0b0b8", "/images": "#d0d0d8", "/music": "#c0c0c8", "/games": "#b8b8c0" };
const bwLabels: Record<string, string> = { "/": "Home", "/movies": "Movies", "/images": "Images", "/music": "Music", "/games": "Games" };

const cgIcons: Record<string, string> = { "/": "home.webp", "/movies": "movie.webp", "/images": "pic.webp", "/music": "music.webp", "/games": "game.webp" };
const cgNames: Record<string, string> = { "/": "Neon", "/movies": "Glitch", "/images": "Prism", "/music": "Pulse", "/games": "Rush" };
const cgColors: Record<string, string> = { "/": "#ff69b4", "/movies": "#da70d6", "/images": "#ff1493", "/music": "#00bfff", "/games": "#ff6347" };
const cgLabels: Record<string, string> = { "/": "Home", "/movies": "Movies", "/images": "Images", "/music": "Music", "/games": "Games" };

const themeMeta: Record<ThemeName, { base: string; heroIcons: Record<string,string>; heroNames: Record<string,string>; heroColors: Record<string,string>; heroLabels: Record<string,string> }> = {
  default: { base: "", heroIcons: {}, heroNames: {}, heroColors: {}, heroLabels: {} },
  "final-fantasy": { base: "/themes/final%20fantasy", heroIcons: ff7Icons, heroNames: ff7Names, heroColors: ff7Colors, heroLabels: ff7Names },
  overwatch: { base: "/themes/over%20watch", heroIcons: owIcons, heroNames: owNames, heroColors: owColors, heroLabels: owLabels },
  genshin: { base: "/themes/Genshin%20impact", heroIcons: giIcons, heroNames: giNames, heroColors: giColors, heroLabels: giLabels },
  "path-of-exile": { base: "/themes/path of exile", heroIcons: poeIcons, heroNames: poeNames, heroColors: poeColors, heroLabels: poeLabels },
  "counter-strike": { base: "/themes/cs2", heroIcons: cs2Icons, heroNames: cs2Names, heroColors: cs2Colors, heroLabels: cs2Labels },
  "pretty-girl": { base: "/themes/pretty%20girl", heroIcons: pgIcons, heroNames: pgNames, heroColors: pgColors, heroLabels: pgLabels },
  "black-white": { base: "/themes/black%20withe", heroIcons: bwIcons, heroNames: bwNames, heroColors: bwColors, heroLabels: bwLabels },
  "cyber-girl": { base: "/themes/cyber%20girl", heroIcons: cgIcons, heroNames: cgNames, heroColors: cgColors, heroLabels: cgLabels },
  rose: { base: "", heroIcons: {}, heroNames: {}, heroColors: {}, heroLabels: {} },
  light: { base: "", heroIcons: {}, heroNames: {}, heroColors: {}, heroLabels: {} },
};

function layoutThemeBaseHue(t: string): number {
  if (t === "overwatch") return 35;
  if (t === "final-fantasy") return 210;
  if (t === "genshin") return 75;
  if (t === "path-of-exile") return 195;
  if (t === "counter-strike") return 95;
  if (t === "pretty-girl") return 330;
  if (t === "black-white") return 260;
  if (t === "cyber-girl") return 290;
  if (t === "rose") return 330;
  if (t === "light") return 220;
  return 250;
}

function layoutBandHue(theme: string, idx: number, total: number): number {
  const base = layoutThemeBaseHue(theme);
  const position = total > 1 ? idx / (total - 1) : 0;
  const hue = base - 40 + position * 80;
  return Math.round(((hue % 360) + 360) % 360);
}

// ── Black White background switcher ──
const BW_BGS = ["/themes/black%20withe/pic/bg1.webp", "/themes/black%20withe/pic/bg2.webp"];

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function BwBgSwitcher({ mode }: { mode: string }) {
  const bgSize = mode === "stretch" ? "100% 100%" : mode === "normal" ? "contain" : "cover";
  const initialBg = pickRandom(BW_BGS);
  const [layers, setLayers] = useState<{ src: string; active: boolean; dur: number }[]>([
    { src: initialBg, active: true, dur: 0 },
    { src: BW_BGS.find((b) => b !== initialBg) || BW_BGS[1], active: false, dur: 0 },
  ]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const doSwitch = useCallback(() => {
    const dur = 1.2 + Math.random() * 1.3;
    setLayers((prev) => {
      const activeSrc = prev.find((l) => l.active)!.src;
      const nextBg = BW_BGS.find((b) => b !== activeSrc) || BW_BGS[0];
      return prev.map((l) =>
        l.active
          ? { ...l, active: false, dur: 0 }
          : { src: nextBg, active: true, dur }
      );
    });
    const next = 8000 + Math.random() * 17000;
    timerRef.current = setTimeout(doSwitch, next);
  }, []);

  useEffect(() => {
    const initial = 6000 + Math.random() * 12000;
    timerRef.current = setTimeout(doSwitch, initial);
    return () => clearTimeout(timerRef.current);
  }, [doSwitch]);

  const eases = ["ease", "ease-in-out", "cubic-bezier(0.4,0,0.2,1)", "cubic-bezier(0.2,0,0.8,1)"];
  return (
    <>
      {layers.map((l, i) => (
        <div
          key={i}
          className="bw-bg-layer"
          style={{
            background: `url("${l.src}") center/${bgSize} no-repeat`,
            opacity: l.active ? "var(--bg-opacity, 0.7)" : 0,
            "--bw-transition-dur": l.active ? `${l.dur}s` : "0.8s",
            "--bw-transition-ease": eases[i % eases.length],
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const meta = themeMeta[theme];
  const hasChars = theme !== "default" && theme !== "rose" && theme !== "light";
  const { myComputer, systemMonitor, clock, calendar, countdown, globalWidgets, widgetPages } = useWidgetStore();
  const isFF7 = theme === "final-fantasy";
  const isOW = theme === "overwatch";
  const isGI = theme === "genshin";
  const isPoE = theme === "path-of-exile";
  const isCS2 = theme === "counter-strike";
  const isPG = theme === "pretty-girl";
  const isBW = theme === "black-white";
  const isCG = theme === "cyber-girl";
  const bgVideoMode = useSettingsStore((s) => s.bgVideoMode);
  const bgOverlayOpacity = useSettingsStore((s) => s.bgOverlayOpacity);
  const headerOpacity = useSettingsStore((s) => s.headerOpacity);
  const footerOpacity = useSettingsStore((s) => s.footerOpacity);
  const isHome = location.pathname === "/";
  // Map path to widget page key: / → home, /movies → movies, /images → images, etc.
  const pageKey = isHome ? "home" : (location.pathname.replace("/", "") as string) || "home";
  const showWidgets = globalWidgets || (widgetPages[pageKey] ?? false);
  const [isFS, setIsFS] = useState(true);
  const wantsFS = useRef(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);

  // ── License init ──
  useEffect(() => { useLicenseStore.getState().init(); }, []);

  // ── Analytics page tracking ──
  const pageName = isHome ? "home" : location.pathname.replace("/", "");
  useAnalyticsPageView(pageName);
  const poeVidRef = useRef<HTMLVideoElement>(null);
  const poeVidBRef = useRef<HTMLVideoElement>(null);
  const [headerVisible, setHeaderVisible] = useState(true);

  // Mouse-driven parallax → CSS custom properties on #app
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const cx = (e.clientX / window.innerWidth) * 2 - 1;   // -1 .. 1
      const cy = (e.clientY / window.innerHeight) * 2 - 1;
      el.style.setProperty("--px", cx.toFixed(3));
      el.style.setProperty("--py", cy.toFixed(3));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ? key → keyboard shortcuts help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !(e.ctrlKey || e.metaKey) && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [footerVisible, setFooterVisible] = useState(true);
  const [bgMusicConfirm, setBgMusicConfirm] = useState<string | null>(null);
  const [bgDontAsk, setBgDontAsk] = useState(false);
  const [showVideoTuner, setShowVideoTuner] = useState(false);
  // Granular selectors — avoid 60fps visualizerBars re-rendering whole layout
  const playerTrack = useAudioPlayerStore((s) => s.track);
  const playerIsPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const playerIsBg = useAudioPlayerStore((s) => s.isBackground);
  const playerDuration = useAudioPlayerStore((s) => s.duration);
  const playerTime = useAudioPlayerStore((s) => s.currentTime);
  const playerVolume = useAudioPlayerStore((s) => s.volume);
  const playerToggle = useAudioPlayerStore((s) => s.toggle);
  const playerSetBg = useAudioPlayerStore((s) => s.setBackground);
  const playerStop = useAudioPlayerStore((s) => s.stop);
  const playerSeek = useAudioPlayerStore((s) => s.seek);
  const playerSetVol = useAudioPlayerStore((s) => s.setVolume);
  const playerPrev = useAudioPlayerStore((s) => s.prev);
  const playerNext = useAudioPlayerStore((s) => s.next);

  // Apply bg opacity to CSS variable for background layers
  useEffect(() => {
    document.documentElement.style.setProperty("--bg-opacity", String(bgOverlayOpacity / 100));
  }, [bgOverlayOpacity]);

  const isMusicPage = location.pathname === "/music";
  const prevPath = useRef(location.pathname);

  // Custom drag: allow left-click dragging but block double-click maximize
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      // Ignore right-clicks and clicks on interactive elements
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, [role=button]")) return;
      getCurrentWindow().startDragging().catch(() => {});
    };
    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, []);

  // Intercept navigation away from /music while playing
  useEffect(() => {
    const leavingMusic = prevPath.current === "/music" && location.pathname !== "/music";
    if (leavingMusic && playerIsPlaying && !playerIsBg) {
      const noAsk = localStorage.getItem("music-bg-no-ask") === "1";
      if (noAsk) {
        playerSetBg(true);
      } else {
        navigate("/music", { replace: true });
        setBgMusicConfirm(location.pathname);
      }
    }
    prevPath.current = location.pathname;
  }, [location.pathname, playerIsPlaying, playerIsBg]);

  const handleBgYes = () => {
    const to = bgMusicConfirm!;
    if (bgDontAsk) {
      localStorage.setItem("music-bg-no-ask", "1");
      kv.set("music-bg-no-ask", "1").catch(() => {});
    }
    playerSetBg(true);
    setBgMusicConfirm(null);
    setBgDontAsk(false);
    navigate(to, { replace: true });
  };

  const handleBgNo = () => {
    playerStop();
    setBgMusicConfirm(null);
    setBgDontAsk(false);
  };

  // Auto-hide header & footer independently
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((s) => {
      if (!s.autoHideHeader) setHeaderVisible(true);
      if (!s.autoHideFooter) setFooterVisible(true);
    });
    const onMove = (e: MouseEvent) => {
      const { autoHideHeader, autoHideFooter } = useSettingsStore.getState();
      if (!autoHideHeader) setHeaderVisible(true); else setHeaderVisible(e.clientY <= 60);
      if (!autoHideFooter) setFooterVisible(true); else setFooterVisible(e.clientY >= window.innerHeight - 50);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); unsub(); };
  }, []);

  // Custom theme color injection
  useEffect(() => {
    const apply = () => {
      const { useCustomColor, customColor } = useSettingsStore.getState();
      const el = document.documentElement;
      if (useCustomColor) {
        const c = computeThemeColors(customColor);
        el.style.setProperty("--color-primary", c.primary);
        el.style.setProperty("--color-primary-light", c.light);
        el.style.setProperty("--color-primary-dark", c.dark);
        el.setAttribute("data-custom-theme", "true");
      } else {
        ["primary","primary-light","primary-dark"].forEach(k => {
          el.style.removeProperty("--color-" + k);
        });
        el.removeAttribute("data-custom-theme");
      }
      // Recompute surface AFTER primary color is set — surface vars reference primary
      applySurface();
    };
    apply();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.useCustomColor !== prev.useCustomColor || s.customColor !== prev.customColor) apply();
    });
  }, []);

  // Global font & icon size via CSS custom properties
  useEffect(() => {
    const apply = () => {
      const { fontSize, iconSize } = useSettingsStore.getState();
      document.documentElement.style.setProperty("--app-font-scale", String(fontSizeScale(fontSize)));
      document.documentElement.style.setProperty("--app-icon-scale", String(iconSizeScale(iconSize)));
    };
    apply();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.fontSize !== prev.fontSize || s.iconSize !== prev.iconSize) apply();
    });
  }, []);

  // Font family
  useEffect(() => {
    applyFontFamily();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.fontFamily !== prev.fontFamily) applyFontFamily(s.fontFamily);
    });
  }, []);

  // Font color injection
  useEffect(() => {
    const apply = () => {
      const { fontPrimaryColor, fontSecondaryColor } = useSettingsStore.getState();
      document.documentElement.style.setProperty("--font-primary", fontPrimaryColor);
      document.documentElement.style.setProperty("--font-secondary", fontSecondaryColor);
    };
    apply();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.fontPrimaryColor !== prev.fontPrimaryColor || s.fontSecondaryColor !== prev.fontSecondaryColor) apply();
    });
  }, []);

  // Windows title bar — config default is decorations:false in tauri.conf.json
  // This effect syncs the runtime toggle (only works when running in Tauri, not browser dev)
  useEffect(() => {
    const sync = () => {
      const { hideTitleBar } = useSettingsStore.getState();
      // Try now; if Tauri IPC isn't ready (browser dev), silently ignore
      getCurrentWindow().setDecorations(!hideTitleBar).catch(() => {});
    };
    // Delay slightly so Tauri window is fully initialized
    const t = setTimeout(sync, 100);
    return () => { clearTimeout(t); };
  }, []);

  // Respect startFullscreen setting, sync language from settings store
  useEffect(() => {
    const { startFullscreen, language } = useSettingsStore.getState();
    if (startFullscreen) {
      getCurrentWindow().setFullscreen(true).catch(() => {});
    } else {
      setIsFS(false);
    }
    // Sync saved language to i18n
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language);
      localStorage.setItem("app-lang", language);
      kv.set("app-lang", language).catch(() => {});
    }
  }, []);

  // PoE background video — A/B roll with configurable loop parameters
  useEffect(() => {
    const vidA = poeVidRef.current;
    const vidB = poeVidBRef.current;
    if (!vidA || !vidB) return;

    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let raf = 0;
    let active: HTMLVideoElement;
    let chaser: HTMLVideoElement;
    let snap: HTMLCanvasElement | null = null;
    let switching = false;
    let blendF = 0;
    let blendFrames = 27;
    let loopCount = 0;        // remaining loops (0=infinite)
    let firstPlayDone = false;
    let loopEndTimeout: ReturnType<typeof setTimeout> | null = null;

    const getCfg = () => useSettingsStore.getState().bgVideoLoop;

    const readCfg = () => {
      const c = getCfg();
      blendFrames = Math.max(1, Math.round(c.transitionMs / (1000 / 60))); // ~16.67ms per frame
    };
    readCfg();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resize = () => {
      // Debounce — fullscreen transitions fire rapid resize events
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!canvas) return;
        const w = window.innerWidth, h = window.innerHeight;
        canvas.width = w; canvas.height = h;
        if (snap) { snap.width = w; snap.height = h; }
      }, 150);
    };

    const nextLoopTime = (vid: HTMLVideoElement): number => {
      const c = getCfg();
      const dur = vid.duration || 30;
      let t = c.loopStart;
      if (c.loopDuration > 0 && t + c.loopDuration < dur) t = Math.min(t, dur - c.loopDuration);
      return Math.max(0, Math.min(t, dur - 0.1));
    };

    const capSnapshot = () => {
      if (!canvas) return;
      if (!snap) snap = document.createElement('canvas');
      snap.width = canvas.width;
      snap.height = canvas.height;
      snap.getContext('2d')!.drawImage(canvas, 0, 0);
    };

    const scheduleLoopEnd = (vid: HTMLVideoElement) => {
      if (loopEndTimeout) clearTimeout(loopEndTimeout);
      const c = getCfg();
      if (c.loopDuration <= 0) return;
      // Schedule a switch after loopDuration seconds
      loopEndTimeout = setTimeout(() => {
        readCfg();
      if (loopCount !== 1) doSwitch(); // loopCount==1 means last iteration
      }, c.loopDuration * 1000);
    };

    const doSwitch = () => {
      const c = getCfg();
      readCfg();

      // Check loop count
      if (!firstPlayDone) {
        firstPlayDone = true;
        if (c.loopCount === 1) return; // loopCount==1 means only first play, no loop
      } else {
        if (c.loopCount > 0) {
          loopCount--;
          if (loopCount <= 0) return; // done looping
        }
      }

      capSnapshot();
      switching = true;
      blendF = 0;
      const old = active;
      active = chaser;
      chaser = old;
      chaser.pause();

      if (firstPlayDone) {
        chaser.currentTime = nextLoopTime(chaser);
      }

      requestAnimationFrame(() => {
        active.play().catch(() => {});
        scheduleLoopEnd(active);
      });
    };

    const setup = () => {
      const c = getCfg();
      readCfg();
      canvas = document.createElement('canvas');
      canvas.className = 'poe-bg-video';
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;opacity:var(--bg-opacity,0.7);';
      vidA.parentNode?.insertBefore(canvas, vidA);
      vidA.style.opacity = '0'; vidA.style.pointerEvents = 'none';
      vidB.style.opacity = '0'; vidB.style.pointerEvents = 'none';
      ctx = canvas.getContext('2d')!;
      resize();
      window.addEventListener('resize', resize);

      const rate = c.playbackRate;
      vidA.playbackRate = rate;
      vidB.playbackRate = rate;
      active = vidA;
      chaser = vidB;
      loopCount = c.loopCount;

      // First play: jump to firstPlayStart if set
      if (c.firstPlayStart > 0 && vidA.duration > c.firstPlayStart) {
        vidA.currentTime = c.firstPlayStart;
        // If firstPlayEnd is set, schedule a switch after (end - start)
        if (c.firstPlayEnd > c.firstPlayStart) {
          setTimeout(() => doSwitch(), (c.firstPlayEnd - c.firstPlayStart) * 1000);
        }
      }

      chaser.currentTime = nextLoopTime(chaser);
      scheduleLoopEnd(active);
    };

    const draw = () => {
      if (!ctx || !canvas) return;
      const w = canvas.width, h = canvas.height;
      const mode = useSettingsStore.getState().bgVideoMode || "fill";
      const isPortrait = h > w;
      const hasVideoDims = active.videoWidth > 0 && active.videoHeight > 0;

      let dx = 0, dy = 0, dw = w, dh = h;
      let needsBg = false;

      if (mode === "stretch") {
        dx = 0; dy = 0; dw = w; dh = h;
      } else if (mode === "fill") {
        needsBg = false;
        if (hasVideoDims) {
          const vw = active.videoWidth, vh = active.videoHeight;
          const scale = Math.max(w / vw, h / vh);
          const sw = vw * scale, sh = vh * scale;
          dx = (w - sw) / 2; dy = (h - sh) / 2;
          dw = sw; dh = sh;
        }
      } else {
        if (isPortrait && hasVideoDims) {
          const vw = active.videoWidth, vh = active.videoHeight;
          const scale = Math.min(w / vw, h / vh);
          dw = vw * scale; dh = vh * scale;
          dx = (w - dw) / 2; dy = (h - dh) / 2;
          needsBg = true;
        }
      }

      if (needsBg) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#0f172a';
        ctx.fillRect(0, 0, w, h);
      }

      if (switching) {
        blendF++;
        const alpha = Math.min(1, blendF / blendFrames);
        if (alpha >= 1) switching = false;
        if (snap) { ctx.globalAlpha = 1; ctx.drawImage(snap, 0, 0, w, h); }
        if (alpha > 0.005) {
          ctx.globalAlpha = alpha;
          ctx.drawImage(active, dx, dy, dw, dh);
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.drawImage(active, dx, dy, dw, dh);
      }
      raf = requestAnimationFrame(draw);
    };

    const onEnded = () => { doSwitch(); };

    // Subscribe to playbackRate changes
    const unsub = useSettingsStore.subscribe((s, prev) => {
      if (s.bgVideoLoop.playbackRate !== prev.bgVideoLoop.playbackRate) {
        vidA.playbackRate = s.bgVideoLoop.playbackRate;
        vidB.playbackRate = s.bgVideoLoop.playbackRate;
      }
    });

    if (vidA.readyState >= 1) { setup(); draw(); }
    else vidA.addEventListener('loadedmetadata', () => { setup(); draw(); }, { once: true });

    vidA.addEventListener('ended', onEnded);
    vidB.addEventListener('ended', onEnded);

    return () => {
      cancelAnimationFrame(raf);
      if (loopEndTimeout) clearTimeout(loopEndTimeout);
      unsub();
      vidA.removeEventListener('ended', onEnded);
      vidB.removeEventListener('ended', onEnded);
      window.removeEventListener('resize', resize);
      canvas?.remove();
      vidA.style.opacity = ''; vidA.style.pointerEvents = '';
      vidB.style.opacity = ''; vidB.style.pointerEvents = '';
    };
  }, [isPoE]);;

  // When video exits browser fullscreen, re-apply Tauri fullscreen (only if user wants FS)
  useEffect(() => {
    const restoreFS = () => {
      if (wantsFS.current && !document.fullscreenElement) {
        getCurrentWindow().setFullscreen(true).catch(() => {});
        setIsFS(true);
      }
    };
    document.addEventListener("fullscreenchange", restoreFS);
    return () => document.removeEventListener("fullscreenchange", restoreFS);
  }, []);

  // After any window resize/state change, re-assert decorations to prevent
  // Win10 native title bar from briefly flashing during transitions.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const win = getCurrentWindow();
        const { hideTitleBar } = useSettingsStore.getState();
        if (!hideTitleBar) return;
        const unlisten = await win.onResized(() => {
          requestAnimationFrame(() => {
            win.setDecorations(false).catch(() => {});
          });
        });
        if (!mounted) unlisten();
        return () => { unlisten(); };
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const toggleFullscreen = async () => {
    const win = getCurrentWindow();
    const next = !isFS;
    wantsFS.current = next;
    // setFullscreen triggers a native window transition that may briefly restore
    // default decorations. Proactively hide decorations so the title bar doesn't flash.
    const { hideTitleBar } = useSettingsStore.getState();
    if (hideTitleBar) {
      win.setDecorations(false).catch(() => {});
      // Re-apply decorations after a short delay in case the transition reverted them
      setTimeout(() => win.setDecorations(false).catch(() => {}), 150);
    }
    await win.setFullscreen(next);
    setIsFS(next);
    // Re-apply decorations after fullscreen transition completes
    if (hideTitleBar) {
      setTimeout(() => win.setDecorations(false).catch(() => {}), 100);
    }
  };

  const headerClass = cn(
    "fixed top-0 left-0 right-0 z-50",
    isOW && "shadow-[0_1px_20px_rgba(249,158,26,0.06)]",
  );
  const headerOpacityStyle = { backgroundColor: `color-mix(in srgb, var(--color-surface) ${headerOpacity}%, transparent)` };

  return (
    <div className="min-h-screen bg-surface" id="app" ref={appRef}>
      {isFF7 && <>
        <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-gradient-to-r from-[#00e5a0] via-[#e6b422] to-[#e74c3c]" />
        <div className="ff7-bg-blur hidden xl:block" />
        <img src="/themes/final%20fantasy/pic/01c2a760faf20511013eaf70121f21.webp" className="ff7-chara-left hidden xl:block" alt="" />
        <img src="/themes/final%20fantasy/pic/cloud%20(2)%20-%20%E5%89%AF%E6%9C%AC.webp" className="ff7-chara-full hidden xl:block" alt="" />
      </>}
      {isOW && <>
        <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] ow-energy-bar" />
        <img src="/themes/over%20watch/pic/link.webp" className="ow-corner-tl hidden xl:block" alt="" />
        <img src="/themes/over%20watch/pic/link%20(1).webp" className="ow-corner-br hidden xl:block" alt="" />
      </>}
      {isGI && <>
        <div className="gi-top-bar fixed top-0 left-0 right-0 z-[60]" />
        <div className="gi-bg-blur hidden xl:block" />
        <img src="/themes/Genshin%20impact/pic/11c8910c3bc8d359834e9355612a682d_8520751116469108155.webp" className="gi-left hidden xl:block" alt="" />
        <img src="/themes/Genshin%20impact/pic/dc654a55b892a026658fccf16e018bb1_4541396394726147215.webp" className="gi-right hidden xl:block" alt="" />
      </>}
      {/* Per-theme gradient backgrounds — exclude themed (PoE/PG/BW/CG) and also default/rose/light which use body::before */}
      {!isPoE && !isPG && !isBW && !isCG && theme !== "default" && theme !== "rose" && theme !== "light" && (
        <div className="fixed inset-0" style={{ zIndex: 5, pointerEvents: "none", opacity: `var(--bg-opacity)`, background:
          isFF7 ? "linear-gradient(180deg, #0a0a14 0%, #0d1b2a 50%, #0a0a14 100%)"
            : isOW ? "linear-gradient(180deg, #0d1117 0%, #1a2535 50%, #0d1117 100%)"
            : isGI ? "linear-gradient(180deg, #1a1410 0%, #2a2018 50%, #1a1410 100%)"
            : isCS2 ? "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)"
            : theme === "rose" ? "linear-gradient(180deg, #1a0f14 0%, #2a1520 50%, #1a0f14 100%)"
            : theme === "light" ? "linear-gradient(180deg, #e8edf2 0%, #d8dfe6 50%, #e8edf2 100%)"
            : "linear-gradient(180deg, #0f172a 0%, #1a2740 50%, #0f172a 100%)"
        }} />
      )}
      {isPoE && <>
        <video ref={poeVidRef} className="poe-bg-video fixed inset-0 object-cover w-full h-full" autoPlay muted playsInline poster="/themes/path of exile/pic/ice.webp" src="/themes/path of exile/pic/ice_moive.mp4" />
        <video ref={poeVidBRef} className="hidden" muted playsInline preload="auto" src="/themes/path of exile/pic/ice_moive.mp4" />
        <div className="poe-bg-fade" />
      </>}
      {isPG && <>
        <img src="/themes/pretty%20girl/pic/bg.webp" alt="" className="fixed inset-0 z-[0] w-full h-full"
          style={{ objectFit: bgVideoMode === "normal" ? "contain" : bgVideoMode === "stretch" ? "fill" : "cover", opacity: `var(--bg-opacity)` }} />
      </>}
      {isBW && <>
        <BwBgSwitcher mode={bgVideoMode} />
        <div className="fixed inset-0 z-[1]" style={{ background: "linear-gradient(180deg, rgba(10,10,14,0.55) 0%, rgba(15,15,20,0.3) 50%, rgba(10,10,14,0.6) 100%)", pointerEvents: "none" }} />
      </>}
      {isCG && <>
        <CyberPcbBackground />
        <CyberGirlBgSwitcher mode={bgVideoMode} />
        <CyberParticles />
        <div className="fixed top-0 left-0 right-0 z-[60] h-[2px]" style={{background:"linear-gradient(90deg, #c74dff, #ff4da6, #00bfff, #ff4da6, #c74dff)"}} />
      </>}
      {isCS2 && <>
        <div className="fixed top-0 left-0 right-0 z-[60] h-[2px]" style={{background:"linear-gradient(90deg, #4a90d9, #de6d1c, #cc4444)"}} />
        <div className="cs2-bg-layer fixed inset-0 z-[0]" style={{ opacity: "var(--bg-opacity, 0.7)" }} />
        <div className="cs2-streams fixed inset-0 z-[1]" />
        <img src="/themes/cs2/pic/counter-strike-2-wallpaper-1-lite.webp" className="cs2-bg-left hidden xl:block" alt="" />
        <img src="/themes/cs2/pic/counter-strike-2-wallpaper-2-lite.webp" className="cs2-bg-right hidden xl:block" alt="" />
      </>}

      <header className={cn(headerClass, !headerVisible && "hidden")} style={headerOpacityStyle}>
        <div
          ref={headerRef}
          className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {isFF7 ? (<><img src={`${meta.base}/pic/logo.webp`} alt="FF7" className="h-10 object-contain" /><span className="text-lg font-bold tracking-wider ff7-text-glow text-primary-light">{t("app.title")}</span></>)
            : isOW ? (<><div className="ow-hex h-9 w-9 bg-gradient-to-br from-[#f99e1a] to-[#d67e0a] p-[2px]"><div className="ow-hex h-full w-full bg-[#0d1117] flex items-center justify-center"><span className="text-sm font-black italic text-[#f99e1a] tracking-tighter">OW</span></div></div><div className="flex flex-col leading-none"><span className="text-[10px] tracking-[0.3em] text-[#f99e1a]/60 uppercase italic font-bold">Overwatch</span><span className="text-sm font-semibold tracking-[0.15em] uppercase italic text-white">{t("app.subtitle")}</span></div></>)
            : isGI ? (<><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#d4a84b] to-[#a07828] shadow-[0_0_15px_rgba(212,168,75,0.4)]"><Sparkles className="h-5 w-5 text-white" /></div><div className="flex flex-col leading-none"><span className="text-[10px] tracking-[0.2em] text-[#d4a84b]/70 uppercase font-bold">Genshin Impact</span><span className="text-sm font-bold tracking-wide gi-text-glow text-[#d4a84b]">{t("app.title")}</span></div></>)
            : isPoE ? (<><div className="flex flex-col leading-none"><span className="poe-title text-sm font-bold">{t("app.title")}</span></div></>)
            : isCS2 ? (<><div className="cs2-logo-badge">CS</div><div className="flex flex-col leading-none"><span className="text-[10px] tracking-[0.3em] text-[#de6d1c]/60 uppercase font-bold">Counter-Strike 2</span><span className="cs2-title text-sm font-bold">{t("app.title")}</span></div></>)
            : isPG ? (<><div className="flex flex-col leading-none"><span className="pg-title text-sm font-bold">{t("app.title")}</span></div></>)
            : isBW ? (<><div className="flex flex-col leading-none"><span className="bw-title text-sm font-bold tracking-[0.15em]">{t("app.title")}</span></div></>)
            : isCG ? (<><div className="flex flex-col leading-none"><span className="cg-title text-sm font-bold tracking-[0.1em]">{t("app.title")}</span></div></>)
            : (<><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-light transition-all duration-500"><span className="text-sm font-bold text-white">M</span></div><span className="text-lg font-semibold transition-all duration-500">{t("app.title")}</span></>)}
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              const charIcon = hasChars ? meta.heroIcons[item.to] : null;
              return (
                <NavLink key={item.to} to={item.to} className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 active:scale-95",
                  isActive
                    ? "bg-primary/15 text-primary-light "
                    : "text-[#b8d0e8] hover:bg-primary/10 hover:text-primary-light ",
                )}>
                  {hasChars && charIcon ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden"><img src={`${meta.base}/icons/${charIcon}`} alt="" className="h-full w-full object-cover" /></div>
                  ) : (<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden"><img src={`/themes/common/${defaultIcons[item.to]}`} alt="" className="h-full w-full object-cover" /></div>)}
                  <span className={cn(isFF7 && "tracking-wider", isGI && "tracking-wide", isPoE && "tracking-wider", isCS2 && "tracking-wider uppercase text-[11px]", isBW && "tracking-[0.12em]", isCG && "tracking-[0.1em]")}>{t(`nav.${item.key}`)}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-0.5">
            <button onClick={toggleFullscreen} className={cn("flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-lighter transition-all duration-300 active:scale-90", isFF7 && "hover:bg-primary/20", isOW && "hover:bg-[#f99e1a]/10", isGI && "hover:bg-[#d4a84b]/10", isPoE && "hover:bg-[#af6025]/10", isCS2 && "hover:bg-[#de6d1c]/10", isPG && "hover:bg-[#ff69b4]/10", isBW && "hover:bg-[#c8a882]/10", isCG && "hover:bg-[#c74dff]/10")} title={isFS ? t("fullscreen.exit") : t("fullscreen.enter")}>
              {isFS ? <Minimize2 className="h-4 w-4 text-gray-400" /> : <Maximize2 className="h-4 w-4 text-gray-400" />}
            </button>
            <button onClick={() => setSearchOpen(true)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-lighter transition-all duration-300 active:scale-90", isFF7 && "hover:bg-primary/20", isOW && "hover:bg-[#f99e1a]/10", isGI && "hover:bg-[#d4a84b]/10", isPoE && "hover:bg-[#af6025]/10", isCS2 && "hover:bg-[#de6d1c]/10", isPG && "hover:bg-[#ff69b4]/10", isBW && "hover:bg-[#c8a882]/10", isCG && "hover:bg-[#c74dff]/10")} title={`${t("search.placeholder")} (Ctrl+K)`}>
              <Search className="h-4 w-4 text-gray-400" />
            </button>
            <button onClick={() => setSettingsOpen(true)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-lighter transition-all duration-300 active:scale-90", isFF7 && "hover:bg-primary/20", isOW && "hover:bg-[#f99e1a]/10", isGI && "hover:bg-[#d4a84b]/10", isPoE && "hover:bg-[#af6025]/10", isCS2 && "hover:bg-[#de6d1c]/10", isPG && "hover:bg-[#ff69b4]/10", isBW && "hover:bg-[#c8a882]/10", isCG && "hover:bg-[#c74dff]/10")} title={t("settings.title")}>
              <Settings className="h-4 w-4 text-gray-400" />
            </button>
            {isPoE && (
              <button onClick={() => setShowVideoTuner((v) => !v)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300", showVideoTuner ? "bg-primary/20 text-primary-light" : "hover:bg-surface-lighter text-gray-400")} title="背景视频调参">
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn("mx-auto max-w-7xl px-6 overflow-hidden", !isHome && "relative rounded-xl")}
        style={isHome
          ? { height: "calc(100vh - 4rem)" }
          : { height: "calc(100vh - 5rem - 3rem)", marginTop: "5rem" }
        }
        data-route={isHome ? "home" : "page"}>
        <div
          className={cn("relative z-[1] h-full overflow-y-auto overscroll-contain", isHome ? "pt-2 pb-14" : "px-0 pt-6")}
        >
          <Outlet />
          <ScrollFade height={56} />
        </div>
      </main>

      <footer className={cn(
        "fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm",
        "transition-all duration-300",
        "h-12",
        !footerVisible && "opacity-0 translate-y-full pointer-events-none",
      )} style={{ backgroundColor: `color-mix(in srgb, var(--color-surface) ${footerOpacity}%, transparent)` }}>
        <div className="mx-auto flex h-full max-w-7xl items-center justify-center px-6 gap-3.5">
          {/* Mini player when in background mode */}
          {playerIsBg && playerTrack && (
            <MiniPlayer />
          )}
          <QuickLaunchBar />
        </div>
      </footer>

      {/* Background playback confirmation dialog */}
      {bgMusicConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-light border border-primary rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">{t("music.bg_playback_title")}</h3>
            <p className="text-sm text-gray-400 mb-4">{t("music.bg_playback_prompt")}</p>
            <label className="flex items-center gap-2 mb-5 cursor-pointer select-none">
              <input type="checkbox" checked={bgDontAsk} onChange={(e) => setBgDontAsk(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-500 bg-transparent accent-primary-light cursor-pointer" />
              <span className="text-xs text-gray-500">不再提示</span>
            </label>
            <div className="flex gap-3 justify-end">
              <button onClick={handleBgNo}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors">
                {t("music.bg_playback_no")}
              </button>
              <button onClick={handleBgYes}
                className="px-4 py-2 rounded-lg text-sm bg-primary/20 text-primary-light hover:bg-primary/30 transition-colors font-medium">
                {t("music.bg_playback_yes")}
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {myComputer.enabled && showWidgets && <MyComputerWidget config={myComputer} />}
      {systemMonitor.enabled && showWidgets && <SystemMonitorWidget config={systemMonitor} />}
      {clock.enabled && showWidgets && <ClockWidget config={clock} />}
      {calendar.enabled && showWidgets && <CalendarWidget config={calendar} />}
      {countdown.enabled && showWidgets && <CountdownWidget config={countdown} />}
      <CountdownAlert />
      <ActivationDialog />
      <PrivacyConsent />
      <UpdateChecker />

      <BgVideoTuner visible={showVideoTuner} onToggle={() => setShowVideoTuner(false)} />
    </div>
  );
}

function MiniPlayer() {
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const [seeking, setSeeking] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Own granular selectors — MiniPlayer is outside Layout scope
  const track = useAudioPlayerStore((s) => s.track);
  const dur = useAudioPlayerStore((s) => s.duration);
  const time = useAudioPlayerStore((s) => s.currentTime);
  const vol = useAudioPlayerStore((s) => s.volume);
  const isBg = useAudioPlayerStore((s) => s.isBackground);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const doToggle = useAudioPlayerStore((s) => s.toggle);
  const doSeek = useAudioPlayerStore((s) => s.seek);
  const doSetVol = useAudioPlayerStore((s) => s.setVolume);
  const doPrev = useAudioPlayerStore((s) => s.prev);
  const doNext = useAudioPlayerStore((s) => s.next);
  const doSetBg = useAudioPlayerStore((s) => s.setBackground);
  const doStop = useAudioPlayerStore((s) => s.stop);

  const pct = dur > 0 ? (time / dur) * 100 : 0;

  const seekTo = useCallback((clientX: number) => {
    if (!barRef.current || !dur) return;
    const rect = barRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    doSeek(p);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => { setSeeking(true); seekTo(e.clientX); }, [seekTo]);

  useEffect(() => {
    if (!seeking) return;
    const onMove = (e: MouseEvent) => seekTo(e.clientX);
    const onUp = () => setSeeking(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [seeking, seekTo]);

  useEffect(() => {
    if (!track && !isPlaying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); doToggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-0.5 shrink-0" style={{ width: "170px" }}>
      {/* Row 1: cover + title + controls */}
      <div className="flex items-center gap-1.5">
        {/* Cover */}
        <div className="w-4 h-4 rounded overflow-hidden bg-surface-lighter shrink-0">
          <img src={track.coverPath || "/themes/common/music.svg"} alt="" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "/themes/common/music.svg"; }} />
        </div>

        {/* Title */}
        <span className="text-[10px] text-white truncate flex-1 leading-none">{track.name}</span>

        {/* Volume toggle */}
        <button onClick={() => vol === 0 ? doSetVol(1) : doSetVol(0)}
          className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-surface-lighter transition-colors shrink-0"
          title={`音量 ${Math.round(vol * 100)}%`}>
          {vol === 0 ? <VolumeX className="h-2.5 w-2.5" /> : <Volume2 className="h-2.5 w-2.5" />}
        </button>

        {/* Controls */}
        <button onClick={doPrev}
          className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-surface-lighter transition-colors shrink-0">
          <SkipBack className="h-2.5 w-2.5" />
        </button>
        <button onClick={doToggle}
          className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-primary/20 transition-colors shrink-0">
          {isPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 ml-0.5" />}
        </button>
        <button onClick={doNext}
          className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-surface-lighter transition-colors shrink-0">
          <SkipForward className="h-2.5 w-2.5" />
        </button>
        <button onClick={() => { doSetBg(false); navigate("/music"); }}
          className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-primary-light hover:bg-primary/10 transition-colors shrink-0"
          title="还原播放器">
          <Maximize2 className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Row 2: full-width progress bar */}
      <div ref={barRef} className="w-full flex items-center cursor-pointer h-1.5" onMouseDown={onMouseDown}>
        <div className="w-full h-[2px] rounded-full bg-surface-lighter relative hover:h-[4px] transition-all">
          <div className="absolute left-0 top-0 h-full rounded-full bg-primary-light"
            style={{ width: `${pct}%`, transition: seeking ? "none" : "width 0.3s linear" }} />
        </div>
      </div>
    </div>
  );
}
