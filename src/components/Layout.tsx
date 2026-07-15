import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Film, Image, Gamepad2, Home, Music, Sun, Sword, Shield, Swords, Maximize2, Minimize2, Search, Settings, Globe, Sparkles, Play, Pause, SkipBack, SkipForward, SlidersHorizontal, X, Volume2, VolumeX, Eye, EyeOff } from "lucide-react";
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
import OnboardingDialog from "@/components/OnboardingDialog";
import PrivacyConsent from "@/components/PrivacyConsent";
import BgVideoTuner from "@/components/BgVideoTuner";
import CyberGirlBgSwitcher from "@/components/CyberGirlBgSwitcher";
import UpdateChecker from "@/components/UpdateChecker";
import WallpaperEngine from "@/components/WallpaperEngine";
import { useLicenseStore, isPro } from "@/stores/licenseStore";
import { useThemePackStore } from "@/stores/themePackStore";
import { analytics, useAnalyticsPageView } from "@/lib/analytics";
import { invoke } from "@tauri-apps/api/core";
import { getMusicCoverFallback } from "@/lib/musicCoverFallback";
import { compareVersions } from "@/lib/compareVersions";
import { useSecurity } from "@/lib/useSecurity";
import { ThemeAssets, themeUrl } from "@/lib/themeBase";

const navItems = [
  { to: "/", key: "home", icon: Home },
  { to: "/movies", key: "movies", icon: Film },
  { to: "/images", key: "images", icon: Image },
  { to: "/music", key: "music", icon: Music },
  { to: "/games", key: "games", icon: Gamepad2 },
];

// Ice Girl nav icons
const iceIcons: Record<string, string> = { "/": "home.webp", "/movies": "movie.webp", "/images": "pic.webp", "/music": "music.webp", "/games": "game.webp" };
const iceNames: Record<string, string> = { "/": "home.ice_icestorm_name", "/movies": "home.ice_icestorm_name", "/images": "home.ice_icestorm_name", "/music": "home.ice_icestorm_name", "/games": "home.ice_icestorm_name" };
const iceColors: Record<string, string> = { "/": "#87ceeb", "/movies": "#b0e0e6", "/images": "#00bfff", "/music": "#4488ff", "/games": "#6a5acd" };
const iceLabels: Record<string, string> = { "/": "home.ice_icestorm_name", "/movies": "home.ice_icestorm_name", "/images": "home.ice_icestorm_name", "/music": "home.ice_icestorm_name", "/games": "home.ice_icestorm_name" };

// Cyber Girl nav icons
const cgIcons: Record<string, string> = { "/": "home.webp", "/movies": "movie.webp", "/images": "pic.webp", "/music": "music.webp", "/games": "game.webp" };
const cgNames: Record<string, string> = { "/": "home.cg_skill1_name", "/movies": "home.cg_skill2_name", "/images": "home.cg_skill3_name", "/music": "home.cg_skill4_name", "/games": "home.cg_skill5_name" };
const cgColors: Record<string, string> = { "/": "#ff69b4", "/movies": "#da70d6", "/images": "#ff1493", "/music": "#00bfff", "/games": "#ff6347" };
const cgLabels: Record<string, string> = { "/": "home.cg_skill1_name", "/movies": "home.cg_skill2_name", "/images": "home.cg_skill3_name", "/music": "home.cg_skill4_name", "/games": "home.cg_skill5_name" };

const noIcons: Record<string,string> = {};
const themeMeta: Record<ThemeName, { heroIcons: Record<string,string>; heroNames: Record<string,string>; heroColors: Record<string,string>; heroLabels: Record<string,string> }> = {
  default: { heroIcons: noIcons, heroNames: noIcons, heroColors: noIcons, heroLabels: noIcons },
  "ice-girl": { heroIcons: iceIcons, heroNames: iceNames, heroColors: iceColors, heroLabels: iceLabels },
  "cyber-girl": { heroIcons: cgIcons, heroNames: cgNames, heroColors: cgColors, heroLabels: cgLabels },
};

function layoutBandHue(theme: string, idx: number, total: number): number {
  const base = theme === "cyber-girl" ? 290 : 195;
  const position = total > 1 ? idx / (total - 1) : 0;
  const hue = base - 40 + position * 80;
  return Math.round(((hue % 360) + 360) % 360);
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const meta = themeMeta[theme];
  const isIce = theme === "ice-girl";
  const isDefault = theme === "default";
  const isCG = theme === "cyber-girl";
  const { myComputer, systemMonitor, clock, calendar, countdown, globalWidgets, widgetPages } = useWidgetStore();
  const compactMode = useSettingsStore((s) => s.compactMode);
  const setCompactMode = useSettingsStore((s) => s.setCompactMode);
  const layoutMode = useSettingsStore((s) => s.layoutMode);
  const setLayoutMode = useSettingsStore((s) => s.setLayoutMode);
  const bgVideoMode = useSettingsStore((s) => s.bgVideoMode);
  const bgOverlayOpacity = useSettingsStore((s) => s.bgOverlayOpacity);
  const headerOpacity = useSettingsStore((s) => s.headerOpacity);
  const footerOpacity = useSettingsStore((s) => s.footerOpacity);
  const isHome = location.pathname === "/";
  const pageKey = isHome ? "home" : (location.pathname.replace("/", "") as string) || "home";
  const showWidgets = globalWidgets || (widgetPages[pageKey] ?? false);
  const [isFS, setIsFS] = useState(true);
  const wantsFS = useRef(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => { useLicenseStore.getState().init(); }, []);
  useSecurity();

  // ── Periodic license check (every 7 days; 30-day grace for offline) ──
  // Uses Rust kv_store timestamps (server + local) to prevent clock manipulation
  // SKIP in dev mode — localhost has no server to check against
  useEffect(() => {
    if ((import.meta as any).env?.VITE_LICENSE_TIER) return;

    const CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
    const GRACE_DAYS = 30;

    const doCheck = async () => {
      const { license, check } = useLicenseStore.getState();
      if (license.tier === "free") return;

      try {
        await check();
        // check() stores timestamps server-side via Rust kv_store — nothing to do here
      } catch (err) {
        // Server unreachable — compute elapsed using physical-time delta
        try {
          const times = await invoke<{ serverTime?: string; localTime?: string }>("get_last_check_times");
          if (times.localTime) {
            const lastLocal = new Date(times.localTime).getTime();
            const elapsed = Math.max(0, Date.now() - lastLocal);
            if (elapsed / (24 * 60 * 60 * 1000) > GRACE_DAYS) {
              // 30+ days without a successful check → degrade to Free
              useLicenseStore.setState({
                license: { tier: "free", duration: "permanent", expiresAt: null, maxDevices: 1 },
              });
            }
          }
        } catch {
          // kv reads failed — keep current state, retry next cycle
        }
      }
    };

    // Run on startup, then every 7 days
    const t = setTimeout(doCheck, 3000); // 3s after mount so init() completes
    const interval = setInterval(doCheck, CHECK_INTERVAL);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);

  // Resume: Pro+ but premium themes not yet downloaded (e.g. app closed mid-download)
  // Uses version comparison: server list vs local registry
  useEffect(() => {
    const checkAndResume = async () => {
      const license = useLicenseStore.getState().license;
      if (!isPro(license.tier)) return;

      const { fetchAvailable, installFromServer, refresh } = useThemePackStore.getState();
      await refresh();

      try {
        await fetchAvailable();
      } catch {
        return; // Server unreachable — retry next launch
      }

      const available = useThemePackStore.getState().availableThemes;
      const installed = useThemePackStore.getState().installedThemes;
      const premium = available.filter(t => t.requires_license !== "free");

      const missing = premium.filter(t => {
        const local = installed.find(i => i.id === t.id);
        if (!local) return true;                     // Not installed at all
        return compareVersions(local.version, t.version) < 0; // Outdated
      });

      for (const theme of missing) {
        try { await installFromServer(theme.id); } catch { /* skip, retry next launch */ }
      }
    };

    const t = setTimeout(checkAndResume, 1500);
    return () => clearTimeout(t);
  }, []);

  const pageName = isHome ? "home" : location.pathname.replace("/", "");
  useAnalyticsPageView(pageName);

  const [headerVisible, setHeaderVisible] = useState(true);

  // Mouse parallax
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const cx = (e.clientX / window.innerWidth) * 2 - 1;
      const cy = (e.clientY / window.innerHeight) * 2 - 1;
      el.style.setProperty("--px", cx.toFixed(3));
      el.style.setProperty("--py", cy.toFixed(3));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ? key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !(e.ctrlKey || e.metaKey) && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault(); setHelpOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [footerVisible, setFooterVisible] = useState(true);
  const [bgMusicConfirm, setBgMusicConfirm] = useState<string | null>(null);
  const [bgDontAsk, setBgDontAsk] = useState(false);
  const [showVideoTuner, setShowVideoTuner] = useState(false);
  const iceVidRef = useRef<HTMLVideoElement>(null);
  const iceVidBRef = useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
    document.documentElement.style.setProperty("--bg-opacity", String(bgOverlayOpacity / 100));
  }, [bgOverlayOpacity]);

  const isMusicPage = location.pathname === "/music";
  const prevPath = useRef(location.pathname);

  // Drag titlebar — only in windowed mode, full header width
  const headerRef = useRef<HTMLElement>(null);
  const isFSRef = useRef(isFS);
  isFSRef.current = isFS;
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Don't drag in fullscreen — there's no window to move
      if (isFSRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, [role=button]")) return;
      getCurrentWindow().startDragging().catch(() => {});
    };
    const onDblClick = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, []);

  // Ice Girl background video — A/B roll with configurable loop parameters
  useEffect(() => {
    const vidA = iceVidRef.current;
    const vidB = iceVidBRef.current;
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
    let loopCount = 0;
    let firstPlayDone = false;
    let loopEndTimeout: ReturnType<typeof setTimeout> | null = null;

    const getCfg = () => useSettingsStore.getState().bgVideoLoop;
    const readCfg = () => { const c = getCfg(); blendFrames = Math.max(1, Math.round(c.transitionMs / (1000 / 60))); };
    readCfg();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resize = () => {
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
      snap.width = canvas.width; snap.height = canvas.height;
      snap.getContext('2d')!.drawImage(canvas, 0, 0);
    };

    const scheduleLoopEnd = (vid: HTMLVideoElement) => {
      if (loopEndTimeout) clearTimeout(loopEndTimeout);
      const c = getCfg();
      if (c.loopDuration <= 0) return;
      loopEndTimeout = setTimeout(() => { readCfg(); if (loopCount !== 1) doSwitch(); }, c.loopDuration * 1000);
    };

    const doSwitch = () => {
      const c = getCfg(); readCfg();
      if (!firstPlayDone) { firstPlayDone = true; if (c.loopCount === 1) return; }
      else { if (c.loopCount > 0) { loopCount--; if (loopCount <= 0) return; } }
      capSnapshot(); switching = true; blendF = 0;
      const old = active; active = chaser; chaser = old; chaser.pause();
      if (firstPlayDone) chaser.currentTime = nextLoopTime(chaser);
      requestAnimationFrame(() => { active.play().catch(() => {}); scheduleLoopEnd(active); });
    };

    const setup = () => {
      const c = getCfg(); readCfg();
      canvas = document.createElement('canvas');
      canvas.className = 'ice-bg-video';
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;opacity:var(--bg-opacity,0.7);';
      vidA.parentNode?.insertBefore(canvas, vidA);
      vidA.style.opacity = '0'; vidA.style.pointerEvents = 'none';
      vidB.style.opacity = '0'; vidB.style.pointerEvents = 'none';
      ctx = canvas.getContext('2d')!;
      resize();
      window.addEventListener('resize', resize);
      const rate = c.playbackRate;
      vidA.playbackRate = rate; vidB.playbackRate = rate;
      active = vidA; chaser = vidB; loopCount = c.loopCount;
      if (c.firstPlayStart > 0 && vidA.duration > c.firstPlayStart) {
        vidA.currentTime = c.firstPlayStart;
        if (c.firstPlayEnd > c.firstPlayStart)
          setTimeout(() => doSwitch(), (c.firstPlayEnd - c.firstPlayStart) * 1000);
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
      if (mode === "stretch") { dx = 0; dy = 0; dw = w; dh = h; }
      else if (mode === "fill") {
        if (hasVideoDims) {
          const vw = active.videoWidth, vh = active.videoHeight;
          const scale = Math.max(w / vw, h / vh);
          const sw = vw * scale, sh = vh * scale;
          dx = (w - sw) / 2; dy = (h - sh) / 2; dw = sw; dh = sh;
        }
      } else {
        if (isPortrait && hasVideoDims) {
          const vw = active.videoWidth, vh = active.videoHeight;
          const scale = Math.min(w / vw, h / vh);
          dw = vw * scale; dh = vh * scale;
          dx = (w - dw) / 2; dy = (h - dh) / 2; needsBg = true;
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
        if (alpha > 0.005) { ctx.globalAlpha = alpha; ctx.drawImage(active, dx, dy, dw, dh); ctx.globalAlpha = 1; }
      } else { ctx.drawImage(active, dx, dy, dw, dh); }
      raf = requestAnimationFrame(draw);
    };

    const onEnded = () => { doSwitch(); };

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
  }, [isIce]);

  // Background music check on leaving music page
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
    if (bgDontAsk) { localStorage.setItem("music-bg-no-ask", "1"); kv.set("music-bg-no-ask", "1").catch(() => {}); }
    playerSetBg(true); setBgMusicConfirm(null); setBgDontAsk(false);
    navigate(to, { replace: true });
  };
  const handleBgNo = () => { playerStop(); setBgMusicConfirm(null); setBgDontAsk(false); };

  // Auto-hide header & footer
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
        ["primary","primary-light","primary-dark"].forEach(k => el.style.removeProperty("--color-" + k));
        el.removeAttribute("data-custom-theme");
      }
      applySurface();
    };
    apply();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.useCustomColor !== prev.useCustomColor || s.customColor !== prev.customColor) apply();
    });
  }, []);

  // Font + icon size
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

  // Font color
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

  // Title bar
  useEffect(() => {
    const sync = () => {
      const { hideTitleBar } = useSettingsStore.getState();
      getCurrentWindow().setDecorations(!hideTitleBar).catch(() => {});
    };
    const t = setTimeout(sync, 100);
    return () => { clearTimeout(t); };
  }, []);

  // Start fullscreen + language
  useEffect(() => {
    const { startFullscreen, language } = useSettingsStore.getState();
    if (startFullscreen) {
      getCurrentWindow().setFullscreen(true).catch(() => {});
    } else { setIsFS(false); }
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language);
      localStorage.setItem("app-lang", language);
      kv.set("app-lang", language).catch(() => {});
    }
  }, []);

  // Decorations guard
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const win = getCurrentWindow();
        const { hideTitleBar } = useSettingsStore.getState();
        if (!hideTitleBar) return;
        const unlisten = await win.onResized(() => {
          requestAnimationFrame(() => { win.setDecorations(false).catch(() => {}); });
        });
        if (!mounted) unlisten();
        return () => { unlisten(); };
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Fullscreen restore
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

  const toggleFullscreen = async () => {
    const win = getCurrentWindow();
    const next = !isFS; wantsFS.current = next;
    const { hideTitleBar } = useSettingsStore.getState();
    if (hideTitleBar) {
      win.setDecorations(false).catch(() => {});
      setTimeout(() => win.setDecorations(false).catch(() => {}), 150);
    }
    await win.setFullscreen(next);
    setIsFS(next);
    if (hideTitleBar) {
      setTimeout(() => win.setDecorations(false).catch(() => {}), 100);
    }
  };

  const headerClass = "fixed top-0 left-0 right-0 z-50";
  const headerOpacityStyle = { backgroundColor: `color-mix(in srgb, var(--color-surface) ${headerOpacity}%, transparent)` };

  return (
    <div className="min-h-screen bg-surface" id="app" ref={appRef}>
      {/* ── Default theme wallpaper engine ── */}
      {isDefault && <WallpaperEngine />}

      {/* ── Ice Girl background ── */}
      {isIce && <>
        <video ref={iceVidRef} className="ice-bg-video fixed inset-0 object-cover w-full h-full" autoPlay muted playsInline poster={ThemeAssets.ice.bg} src={ThemeAssets.ice.bgVideo} />
        <video ref={iceVidBRef} className="hidden" muted playsInline preload="auto" src={ThemeAssets.ice.bgVideo} />
      </>}

      {/* ── Cyber Girl background ── */}
      {isCG && <>
        <CyberGirlBgSwitcher mode={bgVideoMode} />
        <div className="fixed top-0 left-0 right-0 z-[60] h-[1px]" style={{background:"linear-gradient(90deg, transparent, #c74dff, #ff4da6, #00bfff, #ff4da6, #c74dff, transparent)", opacity: 0.5}} />
      </>}

      {/* ── Header ── */}
      <header ref={headerRef} className={cn(headerClass, !headerVisible && "hidden", (compactMode || layoutMode !== "full") && "!h-10")} style={headerOpacityStyle}>
        <div className={cn("mx-auto flex max-w-7xl items-center justify-between px-6", compactMode ? "h-10" : "h-16")}>
          <div className="flex items-center gap-3">
            {isIce ? (
              <div className="flex flex-col leading-none"><span className="ice-title text-sm font-bold">{t("app.title")}</span></div>
            ) : isCG ? (
              <div className="flex flex-col leading-none"><span className="cg-title text-sm font-bold tracking-[0.1em]">{t("app.title")}</span></div>
            ) : (
              <><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-light transition-all duration-500"><span className="text-sm font-bold text-white">M</span></div><span className="text-lg font-semibold transition-all duration-500">{t("app.title")}</span></>
            )}
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              const charIcon = meta.heroIcons[item.to];
              return (
                <NavLink key={item.to} to={item.to} className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 active:scale-95",
                  isActive ? "bg-primary/15 text-primary-light " : "text-[#b8d0e8] hover:bg-primary/10 hover:text-primary-light ",
                )}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden">
                    {charIcon ? (
                      <img src={themeUrl(theme, `icons/${charIcon}`)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <item.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={cn(isIce && "tracking-wider", isCG && "tracking-[0.1em]", compactMode && "hidden")}>{t(`nav.${item.key}`)}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-0.5">
            <button onClick={toggleFullscreen} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-lighter transition-all duration-300 active:scale-90" title={isFS ? t("fullscreen.exit") : t("fullscreen.enter")}>
              {isFS ? <Minimize2 className="h-4 w-4 text-gray-400" /> : <Maximize2 className="h-4 w-4 text-gray-400" />}
            </button>
            <button onClick={() => setSearchOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-lighter transition-all duration-300 active:scale-90" title={`${t("search.placeholder")} (Ctrl+K)`}>
              <Search className="h-4 w-4 text-gray-400" />
            </button>
            {import.meta.env?.VITE_LICENSE_TIER && (
              <button onClick={() => navigate("/studio")} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-lighter transition-all duration-300 active:scale-90" title="主题创作">
                <Sparkles className="h-4 w-4 text-purple-400" />
              </button>
            )}
            <button onClick={() => {
              const modes = ["full", "left", "right"];
              const idx = modes.indexOf(layoutMode);
              setLayoutMode(modes[(idx + 1) % modes.length]);
            }} className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 active:scale-90", layoutMode !== "full" ? "bg-primary/20 text-primary-light" : "hover:bg-surface-lighter text-gray-400")} title={layoutMode === "full" ? "侧边栏模式" : layoutMode === "left" ? "切换到右侧" : "恢复全屏"}>
              {layoutMode === "full" ? <Eye className="h-4 w-4" /> : layoutMode === "left" ? <Eye className="h-4 w-4 rotate-90" /> : <Eye className="h-4 w-4 -rotate-90" />}
            </button>
            <button onClick={() => setSettingsOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-lighter transition-all duration-300 active:scale-90" title={t("settings.title")}>
              <Settings className="h-4 w-4 text-gray-400" />
            </button>
            {isIce && (
              <button onClick={() => setShowVideoTuner((v) => !v)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300", showVideoTuner ? "bg-primary/20 text-primary-light" : "hover:bg-surface-lighter text-gray-400")} title="背景视频调参">
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "overflow-hidden relative rounded-xl transition-all duration-400 ease-in-out",
          layoutMode === "full" && "mx-auto max-w-7xl",
          layoutMode === "left" && "ml-0 mr-auto w-[360px]",
          layoutMode === "right" && "ml-auto mr-0 w-[360px]",
        )}
        style={{
          height: layoutMode === "full" ? "calc(100vh - 5rem - 3rem)" : "100vh",
          marginTop: layoutMode === "full" ? "5rem" : "0",
        }}
        data-route={isHome ? "home" : "page"}>
        <div className={cn("relative z-[1] h-full overflow-y-auto overscroll-contain", layoutMode !== "full" ? "px-3 pt-4" : "px-0 pt-6")}>
          <Outlet />
          <ScrollFade height={56} />
        </div>
      </main>

      <footer className={cn("fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm", "transition-all duration-300", "h-12", (layoutMode !== "full") && "hidden", !footerVisible && "opacity-0 translate-y-full pointer-events-none")}
        style={{ backgroundColor: `color-mix(in srgb, var(--color-surface) ${footerOpacity}%, transparent)` }}>
        <div className="mx-auto flex h-full max-w-7xl items-center justify-center px-6 gap-3.5">
          {playerIsBg && playerTrack && <MiniPlayer />}
          <QuickLaunchBar />
        </div>
      </footer>

      {bgMusicConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-light border border-primary rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">{t("music.bg_playback_title")}</h3>
            <p className="text-sm text-gray-400 mb-4">{t("music.bg_playback_prompt")}</p>
            <label className="flex items-center gap-2 mb-5 cursor-pointer select-none">
              <input type="checkbox" checked={bgDontAsk} onChange={(e) => setBgDontAsk(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-500 bg-transparent accent-primary-light cursor-pointer" />
              <span className="text-xs text-gray-500">不再提示</span>
            </label>
            <div className="flex gap-3 justify-end">
              <button onClick={handleBgNo} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors">{t("music.bg_playback_no")}</button>
              <button onClick={handleBgYes} className="px-4 py-2 rounded-lg text-sm bg-primary/20 text-primary-light hover:bg-primary/30 transition-colors font-medium">{t("music.bg_playback_yes")}</button>
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
      <OnboardingDialog />
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

  const track = useAudioPlayerStore((s) => s.track);
  const dur = useAudioPlayerStore((s) => s.duration);
  const time = useAudioPlayerStore((s) => s.currentTime);
  const vol = useAudioPlayerStore((s) => s.volume);
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
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded overflow-hidden bg-surface-lighter shrink-0">
          <img src={track.coverPath || getMusicCoverFallback()} alt="" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = getMusicCoverFallback(); }} />
        </div>
        <span className="text-[10px] text-white truncate flex-1 leading-none">{track.name}</span>
        <button onClick={() => vol === 0 ? doSetVol(1) : doSetVol(0)} className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-surface-lighter transition-colors shrink-0" title={`音量 ${Math.round(vol * 100)}%`}>
          {vol === 0 ? <VolumeX className="h-2.5 w-2.5" /> : <Volume2 className="h-2.5 w-2.5" />}
        </button>
        <button onClick={doPrev} className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-surface-lighter transition-colors shrink-0"><SkipBack className="h-2.5 w-2.5" /></button>
        <button onClick={doToggle} className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-primary/20 transition-colors shrink-0">
          {isPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 ml-0.5" />}
        </button>
        <button onClick={doNext} className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-surface-lighter transition-colors shrink-0"><SkipForward className="h-2.5 w-2.5" /></button>
        <button onClick={() => { doSetBg(false); navigate("/music"); }} className="h-4 w-4 flex items-center justify-center rounded text-gray-200 hover:text-primary-light hover:bg-primary/10 transition-colors shrink-0" title="还原播放器"><Maximize2 className="h-2.5 w-2.5" /></button>
      </div>
      <div ref={barRef} className="w-full flex items-center cursor-pointer h-1.5" onMouseDown={onMouseDown}>
        <div className="w-full h-[2px] rounded-full bg-surface-lighter relative hover:h-[4px] transition-all">
          <div className="absolute left-0 top-0 h-full rounded-full bg-primary-light" style={{ width: `${pct}%`, transition: seeking ? "none" : "width 0.3s linear" }} />
        </div>
      </div>
    </div>
  );
}
