import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Film, Image, Gamepad2, Home, Music, Maximize2, Minimize2, Search, Settings, X, LayoutGrid, Gauge, Box, Camera } from "lucide-react";
import { lazy } from "react";
const Nv3dViewer = lazy(() => import("@/webgl3d/canvas/Nv3dViewer"));
import DevToolsMenu from "@/components/DevToolsMenu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/utils";
import { kv } from "@/lib/sqliteStore";
import { useThemeStore } from "@/stores/themeStore";
import { useTranslation } from "react-i18next";
import { languages } from "@/i18n";
import QuickLaunchBar from "@/components/QuickLaunchBar";
import QuickHub from "@/components/QuickHub";
import SettingsDialog from "@/components/SettingsDialog";
import GlobalSearch from "@/components/GlobalSearch";
import KeyboardHelp from "@/components/KeyboardHelp";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAudioPlayerStore } from "@/stores/audioPlayerStore";
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
import CyberGirlBgSwitcher from "@/components/CyberGirlBgSwitcher";
import UpdateChecker from "@/components/UpdateChecker";
import WallpaperEngine from "@/components/WallpaperEngine";
import GlobalConfirmDialog from "@/components/GlobalConfirmDialog";

import { useGameStore } from "@/stores/gameStore";
import { useImageStore } from "@/stores/imageStore";
import { useMovieStore } from "@/stores/movieStore";
import { useMusicStore } from "@/stores/musicStore";
import { ImportOverlay } from "@/components/ImportOverlay";
import { useLicenseStore, isPaid } from "@/stores/licenseStore";
import { useThemePackStore } from "@/stores/themePackStore";
import { useIceBackgroundVideo } from "@/hooks/useIceBackgroundVideo";
import { useThemeEffects } from "@/hooks/useThemeEffects";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { useThemeSfx } from "@/hooks/useThemeSfx";
import { useAnalyticsPageView } from "@/lib/analytics";
import { invoke } from "@tauri-apps/api/core";
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

  const neonIcon: Record<string,[string,string]> = {home:["ni-home","neon-magenta"],movies:["ni-play","neon-cyan"],images:["ni-image","neon-green"],music:["ni-music","neon-orange"],games:["ni-gamepad","neon-purple"]};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const isIce = theme === "ice-girl";
  const isDefault = theme === "default";
  const isCG = theme === "cyber-girl";
  const dashboardMode = useSettingsStore((s) => s.dashboardMode);
  const gameIsImporting = useGameStore(s => s.isImporting || s.isScanning);
  const imageIsImporting = useImageStore(s => s.isImporting);
  const movieIsImporting = useMovieStore(s => s.isImporting);
  const musicIsImporting = useMusicStore(s => s.isImporting);
  const isImportingAny = gameIsImporting || imageIsImporting || movieIsImporting || musicIsImporting;
  const perfReduceAnimations = useSettingsStore((s) => s.perfReduceAnimations);
  const cacheCleanupDays = useSettingsStore((s) => s.cacheCleanupDays);
  const cacheCleanupLastRun = useSettingsStore((s) => s.cacheCleanupLastRun);
  const setCacheCleanupLastRun = useSettingsStore((s) => s.setCacheCleanupLastRun);
  const { myComputer, systemMonitor, clock, calendar, countdown } = useWidgetStore();
  const bgVideoMode = useSettingsStore((s) => s.bgVideoMode);
  const videoPaused = useSettingsStore((s) => s.videoPaused);
  const bgOverlayOpacity = useSettingsStore((s) => s.bgOverlayOpacity);
  const barOpacity = useSettingsStore((s) => s.barOpacity);
  const barBlur = useSettingsStore((s) => s.barBlur);
  const glassMasterEnabled = useSettingsStore((s) => s.glassMasterEnabled);
  const globalGlassOpacity = useSettingsStore((s) => s.globalGlassOpacity);
  const globalGlassBlur = useSettingsStore((s) => s.globalGlassBlur);
  const isHome = location.pathname === "/";
  const showQuickHub = true;
  const isHomeStrip = isHome && isDefault && dashboardMode === "strip";
  const [stripOpen, setStripOpen] = useState(false);
  const pageKey = isHome ? "home" : (location.pathname.replace("/", "") as string) || "home";
  const [pageMinimized, setPageMinimized] = useState(useSettingsStore.getState().contentMinimized[pageKey]);
  // 切换页面时同步 pageMinimized（订阅只监听 store 变更，pageKey 变更需手动同步）
  useEffect(() => {
    setPageMinimized(!!useSettingsStore.getState().contentMinimized[pageKey]);
  }, [pageKey]);
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((s, prev) => {
      const now = s.contentMinimized[pageKey];
      const was = prev?.contentMinimized?.[pageKey];
      if (now !== was) setPageMinimized(!!now);
    });
    return unsub;
  }, [pageKey]);
  // Start with a safe default; actual state is read from the Tauri window on mount.
  const [isFS, setIsFS] = useState(false);
  const wantsFS = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [nv3dOpen, setNv3dOpen] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => { useLicenseStore.getState().init(); }, []);
  useSecurity();

  // ── 性能调优：启动时应用优先级设置 ──
  useEffect(() => {
    import("@/lib/usePerformance").then((m) => {
      m.initPerformance();
      m.usePerformanceMonitor();
    });
  }, []);

  // ── Auto-install HEVC video extension on startup ──
  // WebView2 (Chromium) doesn't include HEVC (H.265) decoding by default.
  // For high-resolution video wallpapers to work, the system needs the
  // Microsoft HEVC Video Extension. We bundle it and install silently once.
  useEffect(() => {
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke("install_hevc_if_needed").catch(() => {});
    });
  }, []);

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

    // 每次切回前台时即时检查本地过期（不依赖服务端轮询）
    const onVisible = () => {
      if (document.hidden) return;
      const { license } = useLicenseStore.getState();
      if (license.tier !== "free" && license.expiresAt && Date.now() > new Date(license.expiresAt).getTime()) {
        useLicenseStore.setState({
          license: { tier: "free" as const, duration: "permanent" as const, expiresAt: null, maxDevices: 1 },
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // ── Scheduled cache cleanup ──
  useEffect(() => {
    const days = cacheCleanupDays;
    if (days <= 0) return;

    const doCleanup = async () => {
      // Read fresh from store (not closure) to avoid stale value after init() completes
      const lastRun = useSettingsStore.getState().cacheCleanupLastRun;
      if (lastRun) {
        const elapsed = Date.now() - new Date(lastRun).getTime();
        if (elapsed < days * 24 * 60 * 60 * 1000) return;
      }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("cleanup_invalid_covers");
        setCacheCleanupLastRun(new Date().toISOString());
      } catch (e) {
        console.error("[cache-cleanup] Failed:", e);
      }
    };

    const t = setTimeout(doCleanup, 5000);
    return () => clearTimeout(t);
  }, [cacheCleanupDays]); // cacheCleanupLastRun read fresh via getState() — no need in deps

  // Resume: Pro+ but premium themes not yet downloaded (e.g. app closed mid-download)
  // Uses version comparison: server list vs local registry
  useEffect(() => {
    const checkAndResume = async () => {
      const license = useLicenseStore.getState().license;
      if (!isPaid(license.tier)) return;

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

  // Mouse parallax + auto-hide header/footer — merged single RAF-throttled listener
  useEffect(() => {
    const el = appRef.current;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Parallax
        if (el) {
          el.style.setProperty("--px", (e.clientX / window.innerWidth * 2 - 1).toFixed(3));
          el.style.setProperty("--py", (e.clientY / window.innerHeight * 2 - 1).toFixed(3));
        }
        // Auto-hide
        const { autoHideHeader, autoHideFooter } = useSettingsStore.getState();
        if (!autoHideHeader) setHeaderVisible(true);
        else setHeaderVisible(e.clientY <= 60);
        if (!autoHideFooter) setFooterVisible(true);
        else setFooterVisible(e.clientY >= window.innerHeight - 50);
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Auto-hide: when user turns off autoHideHeader/Footer in settings, force visibility
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((s) => {
      if (!s.autoHideHeader) setHeaderVisible(true);
      if (!s.autoHideFooter) setFooterVisible(true);
    });
    return unsub;
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
  const { iceVidRef, iceVidBRef, iceCanvasRef } = useIceBackgroundVideo(isIce);
  const wallpaperVideoRef = useRef<HTMLVideoElement>(null);

  // Capture screenshot from background video at native resolution (lossless PNG)
  const captureScreenshot = useCallback(async () => {
    try {
      if (isIce) {
        const c = iceCanvasRef.current;
        if (!c || c.width === 0) { console.warn("[screenshot] ice canvas not ready"); return; }
        const dataUrl = c.toDataURL("image/png");
        console.log("[screenshot] invoking save_screenshot, len=", dataUrl.length);
        const savedPath = await invoke<string>("save_screenshot", { data: dataUrl });
        console.log("[screenshot] saved:", savedPath);
      } else {
        const v = wallpaperVideoRef.current;
        if (!v || v.videoWidth === 0) { console.warn("[screenshot] wallpaper video not ready"); return; }
        const out = document.createElement("canvas");
        out.width = v.videoWidth; out.height = v.videoHeight;
        out.getContext("2d")!.drawImage(v, 0, 0, out.width, out.height);
        const dataUrl = out.toDataURL("image/png");
        out.remove();
        console.log("[screenshot] invoking save_screenshot, len=", dataUrl.length);
        const savedPath = await invoke<string>("save_screenshot", { data: dataUrl });
        console.log("[screenshot] saved:", savedPath);
      }
    } catch (e) {
      console.error("[screenshot] failed:", e);
    }
  }, [isIce, iceCanvasRef]);

  // Pause/resume ice girl background video
  useEffect(() => {
    const a = iceVidRef.current;
    const b = iceVidBRef.current;
    if (videoPaused) {
      a?.pause();
      b?.pause();
    } else {
      a?.play().catch(() => {});
      b?.play().catch(() => {});
    }
  }, [videoPaused]);

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

  // Background music check on leaving music page
  useEffect(() => {
    const leavingMusic = prevPath.current === "/music" && location.pathname !== "/music";
    // Update ref FIRST to prevent re-triggering if navigate fires synchronously
    prevPath.current = location.pathname;

    if (leavingMusic && playerIsPlaying && !playerIsBg) {
      const noAsk = localStorage.getItem("music-bg-no-ask") === "1";
      if (noAsk) {
        playerSetBg(true);
      } else {
        setBgMusicConfirm(location.pathname);
        // Defer navigate to avoid React Router state conflict
        setTimeout(() => navigate("/music", { replace: true }), 0);
      }
    }
  }, [location.pathname, playerIsPlaying, playerIsBg]);

  const handleBgYes = () => {
    const to = bgMusicConfirm!;
    if (bgDontAsk) { localStorage.setItem("music-bg-no-ask", "1"); kv.set("music-bg-no-ask", "1").catch(() => {}); }
    playerSetBg(true); setBgMusicConfirm(null); setBgDontAsk(false);
    navigate(to, { replace: true });
  };
  const handleBgNo = () => { playerStop(); setBgMusicConfirm(null); setBgDontAsk(false); };

  // ── Theme CSS-variable effects (color / font / icon / font-family / font-color) ──
  useThemeEffects();

  // ── Theme Token Engine — injects --nv-* CSS variables from Rust ──
  useThemeTokens();

  // ── Theme SFX Engine — plays UI sounds (hover/click/menu/dialog/etc.) ──
  const sfx = useThemeSfx(theme);

  // Sync fullscreen state with actual Tauri window state.
  // On page refresh (Ctrl+R) the native window stays fullscreen, but React
  // state resets to false, which defeats the drag guard and lets the user
  // mouse-drag a fullscreen window.
  useEffect(() => {
    getCurrentWindow().isFullscreen().then(fs => {
      if (fs) { setIsFS(true); wantsFS.current = true; }
    }).catch(() => {});
  }, []);

  // Start fullscreen + language
  // sessionStorage survives Ctrl+R but NOT app close → only enter fullscreen
  // on the first mount of a session, never on a page refresh.
  useEffect(() => {
    const { startFullscreen, language } = useSettingsStore.getState();
    const alreadyDecided = sessionStorage.getItem('nv-fs-decided') === '1';
    if (!alreadyDecided) {
      sessionStorage.setItem('nv-fs-decided', '1');
      if (startFullscreen) {
        getCurrentWindow().setFullscreen(true).catch(() => {});
        setIsFS(true);
        wantsFS.current = true;
      }
    }
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language);
      localStorage.setItem("app-lang", language);
      kv.set("app-lang", language).catch(() => {});
    }
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
    await win.setFullscreen(next);
    setIsFS(next);
  };

  const headerClass = "fixed top-0 left-0 right-0 z-50";
  // Effective glass values: master ON → use global, master OFF → per-area
  const effBarOpacity = glassMasterEnabled ? globalGlassOpacity : barOpacity;
  const effBarBlur = glassMasterEnabled ? globalGlassBlur : barBlur;

  const barBgStyle = { background: `color-mix(in srgb, var(--color-surface) ${effBarOpacity}%, transparent)`, backdropFilter: `blur(${effBarBlur}px) saturate(140%)`, WebkitBackdropFilter: `blur(${effBarBlur}px) saturate(140%)` };

  return (
    <div className={cn("min-h-screen", isDefault && !isHomeStrip && "bg-surface")} id="app" ref={appRef}>
      {/* ── Wallpaper engine — all themes except ice-girl/cyber-girl (those use video bg) ── */}
      {!(isIce || isCG) && <WallpaperEngine videoRef={wallpaperVideoRef} />}

      {/* ── Ice Girl background ── */}
      {isIce && <>
        <video ref={iceVidRef} className="ice-bg-video fixed inset-0 object-cover w-full h-full" crossOrigin="anonymous" muted playsInline poster={ThemeAssets.ice.bg} src={ThemeAssets.ice.bgVideo} />
        <video ref={iceVidBRef} className="hidden" crossOrigin="anonymous" muted playsInline preload="auto" src={ThemeAssets.ice.bgVideo} />
      </>}

      {/* ── Cyber Girl background ── */}
      {isCG && <>
        <CyberGirlBgSwitcher mode={bgVideoMode} />
        <div className="fixed top-0 left-0 right-0 z-[60] h-[1px]" style={{background:"linear-gradient(90deg, transparent, #c74dff, #ff4da6, #00bfff, #ff4da6, #c74dff, transparent)", opacity: 0.5}} />
      </>}

      {/* ── Header ── */}
      <header ref={headerRef} className={cn(headerClass, !headerVisible && "hidden")} style={barBgStyle}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
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
              const ni = neonIcon[item.key] || ["ni-circle","neon-cyan"];
              return (
                <NavLink key={item.to} to={item.to} className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 active:scale-95",
                  isActive ? "bg-primary/15 text-primary-light " : "text-[#b8d0e8] hover:bg-primary/10 hover:text-primary-light ",
                )}
                onClick={() => {
                  // 导航切换时，确保目标页面是可见的
                  const key = item.to === "/" ? "home" : item.to.replace("/", "");
                  const s = useSettingsStore.getState();
                  if (s.contentMinimized[key]) {
                    s.toggleContentMinimized(key);
                  }
                }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {isDefault ? <item.icon className="h-5 w-5" /> : <i className={ni[0] + " " + ni[1] + " lg pulse neon-pulse-anim"}></i>}
                  </div>
                  <span>{t(`nav.${item.key}`)}</span>
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
            <button onClick={() => setSettingsOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-lighter transition-all duration-300 active:scale-90" title={t("settings.title")}>
              <Settings className="h-4 w-4 text-gray-400" />
            </button>
            {import.meta.env.DEV && (
              <button onClick={() => setNv3dOpen(v => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-purple-500/20 transition-all duration-300 active:scale-90" title="3D 预览">
                <Box className={cn("h-4 w-4", nv3dOpen ? "text-purple-400" : "text-gray-400")} />
              </button>
            )}
            {import.meta.env.DEV && <DevToolsMenu />}

          </div>
        </div>
      </header>

      {/* Full-width transparent home is only for ice-girl/cyber-girl (legacy video bg).
          .nvtp themes (like cyberpunk) use the same constrained layout as default. */}
      <main
        className={cn(
          "mx-auto max-w-7xl px-6 overflow-hidden relative rounded-xl transition-opacity duration-300",
          isHome && (isIce || isCG) && "!max-w-none !px-0 !overflow-visible !rounded-none pointer-events-none",
          pageMinimized && "!opacity-0 !pointer-events-none",
        )}
        style={(() => {
          if (isHomeStrip) return { height: "auto", marginTop: 0, background: "transparent", borderColor: "transparent", zIndex: 48 } as React.CSSProperties;
          if (isHome && (isIce || isCG)) return { height: "auto", marginTop: 0, zIndex: 48 };
          return { height: "calc(100vh - 5rem - 3rem - 1rem)", marginTop: "5rem", marginBottom: "1rem", zIndex: 48 };
        })()}
        data-route={isHome ? "home" : "page"}>
        <div className={cn(
          "relative z-[48]",
          isHome && (isIce || isCG)
            ? "overflow-visible [&>*]:pointer-events-auto"
            : "h-full overflow-y-auto overscroll-contain px-0 pt-6 pb-6",
          perfReduceAnimations && "reduce-motion",
        )}>
          <Outlet />
          <ScrollFade height={isHome ? 0 : 56} />
        </div>
      </main>

      {/* ── Footer: glass bar, centered layout ── */}
      <footer
        className={cn("fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 h-12 border-t border-white/5", !footerVisible && "opacity-0 translate-y-full pointer-events-none")}
        style={barBgStyle}
      >
        <div className="flex items-center justify-center gap-2.5 h-full px-4">
          {/* QuickHub trigger button (all pages) */}
          {showQuickHub && (
            <button
              onClick={() => setStripOpen((v) => !v)}
              className={cn(
                "shrink-0 h-8 w-8 flex items-center justify-center rounded-lg transition-colors",
                stripOpen ? "bg-primary/15 text-primary-light" : "text-gray-400 hover:text-white hover:bg-white/5",
              )}
              title={t("settings.quick_hub")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          )}

          {/* 页面内容显隐切换 — 所有页面始终可用 */}
          <button
            onClick={() => {
              const pageKey = isHome ? "home" : location.pathname.replace("/", "") || "home";
              useSettingsStore.getState().toggleContentMinimized(pageKey);
            }}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={t("settings.toggle_page")}
          >
            <Gauge className="h-4 w-4" />
          </button>

          {/* Pause/Play background video */}
          <button
            onClick={() => useSettingsStore.getState().setVideoPaused(!videoPaused)}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={videoPaused ? t("settings.bg_video_play") : t("settings.bg_video_pause")}
          >
            {videoPaused ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            )}
          </button>

          {/* Capture current frame from background video */}
          {!(isIce || isCG) && (
            <button onClick={captureScreenshot}
              className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              title={t("settings.bg_video_capture")}>
              <Camera className="h-4 w-4" />
            </button>
          )}

          {/* Divider between Gauge and QuickLaunch */}
          <div className="w-px h-5 bg-white/[0.08] shrink-0" />

          {/* QuickLaunch apps */}
          <QuickLaunchBar />
        </div>
      </footer>

      {/* ── QuickHub popover — above footer toolbar, centered horizontally ── */}
      {showQuickHub && stripOpen && (
        <div className="fixed inset-0 z-[55]" onClick={() => setStripOpen(false)}>
          <div
            className="absolute left-1/2 bottom-14 w-full rounded-2xl"
            style={{
              transform: "translateX(-50%)",
              maxWidth: "min(576px, calc(100vw - 2rem))",
              maxHeight: "calc(100vh - 5rem)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <QuickHub onClose={() => setStripOpen(false)} />
          </div>
        </div>
      )}

      {bgMusicConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-light border border-primary rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">{t("music.bg_playback_title")}</h3>
            <p className="text-sm text-gray-400 mb-4">{t("music.bg_playback_prompt")}</p>
            <label className="flex items-center gap-2 mb-5 cursor-pointer select-none">
              <input type="checkbox" checked={bgDontAsk} onChange={(e) => setBgDontAsk(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-500 bg-transparent accent-primary-light cursor-pointer" />
              <span className="text-xs text-gray-500">{t("common.dont_ask_again")}</span>
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

      {myComputer.enabled && <MyComputerWidget config={myComputer} />}
      {systemMonitor.enabled && <SystemMonitorWidget config={systemMonitor} />}
      {clock.enabled && <ClockWidget config={clock} />}
      {calendar.enabled && <CalendarWidget config={calendar} />}
      {countdown.enabled && <CountdownWidget config={countdown} />}
      <CountdownAlert />
      <OnboardingDialog />
      <ActivationDialog />
      <PrivacyConsent />
      <UpdateChecker />

      {nv3dOpen && (
        <div className="fixed inset-0 z-[300] bg-black" onClick={e => e.target === e.currentTarget && setNv3dOpen(false)}>
          <button onClick={() => setNv3dOpen(false)} className="absolute top-4 right-4 z-[310] flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 hover:bg-red-500/30 transition-all active:scale-90" title="关闭 3D 预览">
            <X className="h-4 w-4 text-white" />
          </button>
          <Nv3dViewer />
        </div>
      )}

      <GlobalConfirmDialog />
      <ImportOverlay isOpen={isImportingAny} />
    </div>
  );
}


