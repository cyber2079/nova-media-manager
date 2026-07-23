import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useThemeStore, useAvailableThemes, type ThemeName } from "@/stores/themeStore";
import { kv } from "@/lib/sqliteStore";
import { useSettingsStore, applySurface, FONT_LIST, type BgVideoMode, type FontSize, type IconSize, type ImageWheelMode } from "@/stores/settingsStore";
import { languages } from "@/i18n";
import { cn } from "@/lib/utils";
import ScrollFade from "@/components/ScrollFade";
import ThemeManager from "@/components/ThemeManager";
import BgVideoTuner from "@/components/BgVideoTuner";
import { Palette, Monitor, SlidersHorizontal, Music, RotateCcw, Gauge, Sparkles, EyeOff, Eye, Copy, Check, Key, Crown, Cpu, Clock, Calendar, Timer, FolderOpen, ImageIcon, Shuffle, Home, LogOut } from "lucide-react";
import { useLicenseStore } from "@/stores/licenseStore";
import { ACCENT_OPTIONS } from "@/stores/settingsStore";
import { useWidgetStore } from "@/stores/widgetStore";
import { useThemePackStore } from "@/stores/themePackStore";

interface Props { open: boolean; onClose: () => void; }

interface ThemeListItem {
  key: string;
  labelKey: string;
  label: string;
  emoji: string;
  image?: string;
}

// ═══════════════ TABS ═══════════════
type TabId = "general" | "appearance" | "media" | "widgets" | "performance";

const tabs: { id: TabId; icon: typeof SlidersHorizontal; labelKey: string }[] = [
  { id: "general", icon: SlidersHorizontal, labelKey: "settings.tab_general" },
  { id: "appearance", icon: Palette, labelKey: "settings.tab_appearance" },
  { id: "media", icon: Music, labelKey: "settings.tab_media" },
  { id: "widgets", icon: Monitor, labelKey: "settings.tab_widgets" },
  { id: "performance", icon: Gauge, labelKey: "settings.tab_performance" },
];

// ═══════════════ DEFAULTS ═══════════════
const DEFAULTS = {
  general: { language: "zh", autoStart: true, startFullscreen: true },
  appearance: { theme: "default" as ThemeName, bgVideoMode: "cover" as BgVideoMode, fontSize: "normal" as FontSize, fontFamily: "inter", paletteAccent: "#4788f0", paletteSaturation: 50, paletteCustomized: false, glassMasterEnabled: true, globalGlassOpacity: 70, globalGlassBlur: 3, barOpacity: 92, barBlur: 16, mainOpacity: 92, mainBlur: 16, dialogOpacity: 92, dialogBlur: 16, autoHideHeader: false, autoHideFooter: false, wallpaper: { mode: "none" as const, path: "", shuffle: "sequential" as const, interval: 30, fit: "none" as const } },
  media: { previewOffset: 0.5, lyricFontSize: "normal" as const, lyricUseCustomColor: false, lyricCurrentColor: "#ffffff", lyricOtherColor: "#8899aa", lyricFillColor: "#ffb6c1", playerBgMode: "follow" as const, playerBgColor: "", cyberBgmEnabled: true, imageWheelMode: "prevNext" as ImageWheelMode, externalPlayer: { mode: "auto" as const, kind: "", path: "" } },
  widgets: {
    widgetTextColor: "#e8f4ff",
    myComputer: { enabled: false, position: "bottom-left" as const, myComputerMode: "default" as const },
    systemMonitor: { enabled: false, position: "bottom-right" as const },
    clock: { enabled: false, position: "top-right" as const },
    calendar: { enabled: false, position: "top-left" as const },
    countdown: { enabled: false, position: "center-right" as const, displayMode: "full" as const, hours: 0, minutes: 5, seconds: 0, loopCount: 1, alertGlow: false, alertVoice: true, voiceInterval: 30 }},
  performance: { perfPriority: "normal" as const, perfIdleReduce: true, perfReduceAnimations: false, cacheCleanupDays: 30, hardwareAcceleration: true },
};

// ═══════════════ MAIN COMPONENT ═══════════════
export default function SettingsDialog({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const availableThemes = useAvailableThemes();
  const installedThemes = useThemePackStore((s) => s.installedThemes);

  // Build theme list dynamically: default + deduplicated installed .nvtp themes
  const seen = new Set<string>(["default"]);
  const themeList: ThemeListItem[] = [
    { key: "default", labelKey: "settings.theme_default", label: t("settings.theme_default"), emoji: "🏠" },
    ...installedThemes.filter(t => t.enabled).reduce<ThemeListItem[]>((acc, t) => {
      if (seen.has(t.id)) return acc;
      seen.add(t.id);
      acc.push({
        key: t.id,
        labelKey: "",
        label: t.name,
        emoji: "🧩",
        image: undefined, // preview via nova:// only works in production; skip in dev
      });
      return acc;
    }, []),
  ];
  const filteredThemeList = themeList.filter(t => availableThemes.includes(t.key));
  const {
    language, autoStart, startFullscreen, autoHideHeader, autoHideFooter,
    bgVideoMode, setLanguage, setAutoStart, setStartFullscreen,
    setAutoHideHeader, setAutoHideFooter, setBgVideoMode,
    previewOffset, setPreviewOffset, lyricFontSize, setLyricFontSize,
    lyricUseCustomColor, setLyricUseCustomColor, lyricCurrentColor, setLyricCurrentColor,
    lyricOtherColor, setLyricOtherColor, lyricFillColor, setLyricFillColor,
    fontSize, iconSize, setFontSize, setIconSize, fontFamily, setFontFamily,
    imageWheelMode, setImageWheelMode,
    barOpacity, setBarOpacity, barBlur, setBarBlur,
    glassMasterEnabled, setGlassMasterEnabled, globalGlassOpacity, setGlobalGlassOpacity, globalGlassBlur, setGlobalGlassBlur,
    mainOpacity, setMainOpacity, mainBlur, setMainBlur,
    dialogOpacity, setDialogOpacity, dialogBlur, setDialogBlur,
    bgOverlayOpacity, setBgOverlayOpacity,
    fontPrimaryColor, fontSecondaryColor, widgetTextColor, setFontPrimaryColor, setFontSecondaryColor, setWidgetTextColor,
    scrollFadeOpacity, setScrollFadeOpacity,
    playerBgColor, playerBgMode, setPlayerBgColor, setPlayerBgMode,
    cyberBgmEnabled, setCyberBgmEnabled,
    cgTextSize, cgTextColor, setCgTextSize, setCgTextColor,
    paletteAccent, paletteSaturation, setPaletteAccent, setPaletteSaturation, resetPaletteToTheme,
    dashboardMode, setDashboardMode, hardwareAcceleration, setHardwareAcceleration,
    setWallpaperConfig, setExternalPlayer,
    perfPriority, setPerfPriority, perfIdleReduce, setPerfIdleReduce,
    perfReduceAnimations, setPerfReduceAnimations, cacheCleanupDays, setCacheCleanupDays,
    applyPerfSettings,
  } = useSettingsStore();
  const { myComputer, systemMonitor, clock, calendar, countdown, setEnabled, setPosition, setMyComputerMode, setCountdown } = useWidgetStore();
  const [autoLoading, setAutoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [confirmReset, setConfirmReset] = useState<"all" | TabId | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const loadedRef = useRef(false);

  if (open && !loadedRef.current) {
    loadedRef.current = true;
    (async () => {
      try {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        const on = await isEnabled();
        if (on !== autoStart) useSettingsStore.setState({ autoStart: on });
      } catch {}
    })();
  }
  if (!open) loadedRef.current = false;

  const handleLanguage = (code: string) => {
    setLanguage(code); i18n.changeLanguage(code);
    localStorage.setItem("app-lang", code);
    kv.set("app-lang", code).catch(() => {});
  };

  const handleAutoStart = async () => { setAutoLoading(true); await setAutoStart(!autoStart); setAutoLoading(false); };
  const handleTheme = (t: ThemeName) => { setTheme(t); };

  // ── Reset ──
  const doResetTab = useCallback((tab: TabId) => {
    switch (tab) {
      case "general": {
        const d = DEFAULTS.general;
        setLanguage(d.language); i18n.changeLanguage(d.language);
        localStorage.setItem("app-lang", d.language); kv.set("app-lang", d.language).catch(() => {});
        setAutoStart(d.autoStart); setStartFullscreen(d.startFullscreen);
        break;
      }
      case "appearance": {
        const d = DEFAULTS.appearance;
        setTheme(d.theme); setBgVideoMode(d.bgVideoMode);
        setFontSize(d.fontSize); setFontFamily(d.fontFamily);
        setPaletteAccent(d.paletteAccent); setPaletteSaturation(d.paletteSaturation);
        setBarOpacity(d.barOpacity); setBarBlur(d.barBlur);
        setGlassMasterEnabled(d.glassMasterEnabled); setGlobalGlassOpacity(d.globalGlassOpacity); setGlobalGlassBlur(d.globalGlassBlur);
        setMainOpacity(d.mainOpacity); setMainBlur(d.mainBlur);
        setDialogOpacity(d.dialogOpacity); setDialogBlur(d.dialogBlur);
        setAutoHideHeader(d.autoHideHeader); setAutoHideFooter(d.autoHideFooter);
        setWallpaperConfig(d.wallpaper);
        setTimeout(() => applySurface(), 0);
        break;
      }
      case "media": {
        const d = DEFAULTS.media;
        setPreviewOffset(d.previewOffset); setLyricFontSize(d.lyricFontSize);
        setLyricUseCustomColor(d.lyricUseCustomColor); setLyricCurrentColor(d.lyricCurrentColor);
        setLyricOtherColor(d.lyricOtherColor); setLyricFillColor(d.lyricFillColor);
        setPlayerBgMode(d.playerBgMode); setPlayerBgColor(d.playerBgColor);
        setCyberBgmEnabled(d.cyberBgmEnabled); setImageWheelMode(d.imageWheelMode);
        setExternalPlayer(d.externalPlayer);
        break;
      }
      case "widgets": {
        const d = DEFAULTS.widgets;
        setEnabled("myComputer", d.myComputer.enabled); setPosition("myComputer", d.myComputer.position); setMyComputerMode(d.myComputer.myComputerMode);
        setEnabled("systemMonitor", d.systemMonitor.enabled); setPosition("systemMonitor", d.systemMonitor.position);
        setEnabled("clock", d.clock.enabled); setPosition("clock", d.clock.position);
        setEnabled("calendar", d.calendar.enabled); setPosition("calendar", d.calendar.position);
        setCountdown(d.countdown);
        setWidgetTextColor(d.widgetTextColor);
        break;
      }
      case "performance": {
        const d = DEFAULTS.performance;
        setPerfPriority(d.perfPriority); setPerfIdleReduce(d.perfIdleReduce);
        setPerfReduceAnimations(d.perfReduceAnimations); setCacheCleanupDays(d.cacheCleanupDays);
        setHardwareAcceleration(d.hardwareAcceleration);
        applyPerfSettings();
        break;
      }
    }
    setConfirmReset(null);
  }, [setLanguage, i18n, setAutoStart, setStartFullscreen, setAutoHideHeader, setAutoHideFooter,
      setTheme, setBgVideoMode, setFontSize, setFontFamily,
      setPaletteAccent, setPaletteSaturation, setBarOpacity, setBarBlur,
      setGlassMasterEnabled, setGlobalGlassOpacity, setGlobalGlassBlur, setMainOpacity, setMainBlur, setDialogOpacity, setDialogBlur,
      setPreviewOffset, setLyricFontSize, setLyricUseCustomColor, setLyricCurrentColor, setLyricOtherColor, setLyricFillColor, setImageWheelMode,
      setPlayerBgMode, setPlayerBgColor, setCyberBgmEnabled,
      setEnabled, setPosition, setMyComputerMode, setCountdown,
      setPerfPriority, setPerfIdleReduce, setPerfReduceAnimations, setCacheCleanupDays, applyPerfSettings]);

  const doResetAll = useCallback(() => { for (const tab of tabs) doResetTab(tab.id); setConfirmReset(null); }, [doResetTab]);

  // Dialog glass: unified formula, same as bar / main area
  const effDialogOpacity = glassMasterEnabled ? globalGlassOpacity : dialogOpacity;
  const effDialogBlur = glassMasterEnabled ? globalGlassBlur : dialogBlur;
  const dialogGlassStyle = {
    background: `color-mix(in srgb, var(--color-surface) ${effDialogOpacity}%, transparent)`,
    backdropFilter: `blur(${effDialogBlur}px) saturate(140%)`,
    WebkitBackdropFilter: `blur(${effDialogBlur}px) saturate(140%)`,
    border: "1px solid color-mix(in srgb, var(--color-primary) 6%, transparent)",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl overflow-hidden flex flex-col p-0 gap-0 rounded-2xl" style={{
        height: "72vh", maxHeight: "85vh",
        ...dialogGlassStyle,
      }}>
        {/* Title bar */}
        <div className={cn("relative flex items-center justify-between px-6 pt-5 pb-3 border-b",
          "border-white/5")}>
          <DialogTitle className="theme-text-glow">{t("settings.title")}</DialogTitle>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 relative">
          {/* Left tab nav */}
          <div className={cn("w-44 shrink-0 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto border-r",
            "border-white/5")}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn("flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 text-left rounded-lg",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200")}>
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
            {/* Spacer pushes quit to bottom */}
            <div className="flex-1" />
            <div className="border-t border-white/[0.06] pt-1 mt-1">
              <button onClick={() => setConfirmQuit(true)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 text-left rounded-lg w-full text-red-400/70 hover:bg-red-400/8 hover:text-red-400">
                <LogOut className="h-4 w-4 shrink-0" />
                <span>{t("settings.tab_quit")}</span>
              </button>
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 relative">
            {activeTab === "general" && <GeneralTab t={t} language={language} handleLanguage={handleLanguage} languages={languages} autoStart={autoStart} autoLoading={autoLoading} handleAutoStart={handleAutoStart} startFullscreen={startFullscreen} setStartFullscreen={setStartFullscreen} resetTab={() => setConfirmReset("general")} />}

            {activeTab === "appearance" && <AppearanceTab t={t} theme={theme} filteredThemeList={filteredThemeList} handleTheme={handleTheme} paletteAccent={paletteAccent} paletteSaturation={paletteSaturation} setPaletteAccent={setPaletteAccent} setPaletteSaturation={setPaletteSaturation} resetPaletteToTheme={resetPaletteToTheme} bgVideoMode={bgVideoMode} setBgVideoMode={setBgVideoMode} autoHideHeader={autoHideHeader} setAutoHideHeader={setAutoHideHeader} autoHideFooter={autoHideFooter} setAutoHideFooter={setAutoHideFooter} barOpacity={barOpacity} setBarOpacity={setBarOpacity} barBlur={barBlur} setBarBlur={setBarBlur} glassMasterEnabled={glassMasterEnabled} setGlassMasterEnabled={setGlassMasterEnabled} globalGlassOpacity={globalGlassOpacity} setGlobalGlassOpacity={setGlobalGlassOpacity} globalGlassBlur={globalGlassBlur} setGlobalGlassBlur={setGlobalGlassBlur} mainOpacity={mainOpacity} setMainOpacity={setMainOpacity} mainBlur={mainBlur} setMainBlur={setMainBlur} dialogOpacity={dialogOpacity} setDialogOpacity={setDialogOpacity} dialogBlur={dialogBlur} setDialogBlur={setDialogBlur} dashboardMode={dashboardMode} setDashboardMode={setDashboardMode} fontSize={fontSize} setFontSize={setFontSize} iconSize={iconSize} setIconSize={setIconSize} fontFamily={fontFamily} setFontFamily={setFontFamily} resetTab={() => setConfirmReset("appearance")} />}

            {activeTab === "media" && <MediaTab t={t} previewOffset={previewOffset} setPreviewOffset={setPreviewOffset} lyricFontSize={lyricFontSize} setLyricFontSize={setLyricFontSize} lyricUseCustomColor={lyricUseCustomColor} setLyricUseCustomColor={setLyricUseCustomColor} lyricCurrentColor={lyricCurrentColor} setLyricCurrentColor={setLyricCurrentColor} lyricOtherColor={lyricOtherColor} setLyricOtherColor={setLyricOtherColor} lyricFillColor={lyricFillColor} setLyricFillColor={setLyricFillColor} playerBgMode={playerBgMode} playerBgColor={playerBgColor} setPlayerBgMode={setPlayerBgMode} setPlayerBgColor={setPlayerBgColor} cyberBgmEnabled={cyberBgmEnabled} setCyberBgmEnabled={setCyberBgmEnabled} imageWheelMode={imageWheelMode} setImageWheelMode={setImageWheelMode} resetTab={() => setConfirmReset("media")} />}

            {activeTab === "widgets" && <WidgetsTab t={t} myComputer={myComputer} systemMonitor={systemMonitor} clock={clock} calendar={calendar} countdown={countdown} setEnabled={setEnabled} setPosition={setPosition} setMyComputerMode={setMyComputerMode} setCountdown={setCountdown} widgetTextColor={widgetTextColor} setWidgetTextColor={setWidgetTextColor} resetTab={() => setConfirmReset("widgets")} />}
            {activeTab === "performance" && <PerformanceTab t={t} perfPriority={perfPriority} setPerfPriority={setPerfPriority} perfIdleReduce={perfIdleReduce} setPerfIdleReduce={setPerfIdleReduce} perfReduceAnimations={perfReduceAnimations} setPerfReduceAnimations={setPerfReduceAnimations} cacheCleanupDays={cacheCleanupDays} setCacheCleanupDays={setCacheCleanupDays} hardwareAcceleration={hardwareAcceleration} setHardwareAcceleration={setHardwareAcceleration} applyPerfSettings={applyPerfSettings} resetTab={() => setConfirmReset("performance")} />}

            <ScrollFade height={48} />
          </div>
        </div>

        {/* Footer */}
        <div className={cn("relative px-6 py-3 border-t flex items-center gap-2",
          "border-white/5")}>
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">{t("settings.close")}</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset("all")} className="gap-1.5 text-gray-400">
            <RotateCcw className="h-3.5 w-3.5" />{t("settings.reset_defaults")}
          </Button>
        </div>
      </DialogContent>

      {confirmReset && (
        <ConfirmDialog message={confirmReset === "all" ? t("settings.confirm_reset_all") : t("settings.confirm_reset_tab", { tab: t(`settings.tab_${confirmReset}`) })}
          confirmLabel={t("settings.confirm_reset")}
          onConfirm={() => { if (confirmReset === "all") doResetAll(); else doResetTab(confirmReset); }}
          onCancel={() => setConfirmReset(null)} />
      )}

      {confirmQuit && (
        <ConfirmDialog message={t("settings.confirm_quit")}
          confirmLabel={t("settings.tab_quit")}
          onConfirm={async () => { const { exit } = await import("@tauri-apps/plugin-process"); exit(0); }}
          onCancel={() => setConfirmQuit(false)} />
      )}
    </Dialog>
  );
}

// ═══════════════ REUSABLE LAYOUT PRIMITIVES ═══════════════

function SectionGroup({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6", className)}>
      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 pl-0.5">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4", className)}>
      {children}
    </div>
  );
}

interface SettingRowProps { label: string; hint?: string; children: React.ReactNode; }
function SettingRow({ label, hint, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-300">
        {label}
        {hint && <span className="text-[10px] text-gray-500 ml-1.5">{hint}</span>}
      </span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface CardDividerProps { className?: string; }
function CardDivider({ className }: CardDividerProps) {
  return <div className={cn("border-t border-white/[0.05]", className)} />;
}

// ═══════════════ GENERAL TAB ═══════════════

function GeneralTab({ t, language, handleLanguage, languages, autoStart, autoLoading, handleAutoStart, startFullscreen, setStartFullscreen, resetTab }: any) {
  return (
    <>
      <SectionGroup title={t("license.title")}><LicenseSection t={t} /></SectionGroup>
      <SectionGroup title={t("settings.language")}>
        <SettingCard>
          <div className="grid grid-cols-2 gap-3">
            {languages.map((lang: any) => (
              <button key={lang.code} onClick={() => handleLanguage(lang.code)}
                className={cn("text-left px-4 py-3 rounded-lg text-sm transition-all duration-200 border",
                  language === lang.code ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                {lang.i18nKey ? t(lang.i18nKey) : lang.label}
              </button>
            ))}
          </div>
        </SettingCard>
      </SectionGroup>
      <SectionGroup title={t("settings.startup")}>
        <SettingCard>
          <SettingRow label={t("settings.auto_launch")}><Toggle active={autoStart} disabled={autoLoading} onToggle={handleAutoStart} /></SettingRow>
          <CardDivider />
          <SettingRow label={t("settings.start_fullscreen")}><Toggle active={startFullscreen} onToggle={() => setStartFullscreen(!startFullscreen)} /></SettingRow>
        </SettingCard>
      </SectionGroup>
      <SectionGroup title={t("settings.data_manage")}><DataSection t={t} /></SectionGroup>
      <SectionGroup title={t("settings.feedback")}><FeedbackSection t={t} /></SectionGroup>
      <ResetButton tab="general" t={t} onReset={resetTab} />
    </>
  );
}

// ═══════════════ APPEARANCE TAB ═══════════════

function AppearanceTab(props: any) {
  const { t, theme, filteredThemeList, handleTheme, paletteAccent, paletteSaturation, setPaletteAccent, setPaletteSaturation, resetPaletteToTheme, bgVideoMode, setBgVideoMode, autoHideHeader, setAutoHideHeader, autoHideFooter, setAutoHideFooter, barOpacity, setBarOpacity, barBlur, setBarBlur, glassMasterEnabled, setGlassMasterEnabled, globalGlassOpacity, setGlobalGlassOpacity, globalGlassBlur, setGlobalGlassBlur, mainOpacity, setMainOpacity, mainBlur, setMainBlur, dialogOpacity, setDialogOpacity, dialogBlur, setDialogBlur, dashboardMode, setDashboardMode, fontSize, setFontSize, iconSize, setIconSize, fontFamily, setFontFamily, resetTab } = props;
  return (
    <>
      {/* ═══ Theme ═══ */}
      <SectionGroup title={t("settings.theme")}>
        <SettingCard>
          <div className="grid grid-cols-3 gap-2">
            {filteredThemeList.map((item: any) => (
              <button key={item.key} onClick={() => handleTheme(item.key)}
                className={cn("flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg text-xs border transition-all duration-200",
                  theme === item.key ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                {item.image ? <img src={item.image} alt="" className="w-10 h-10 rounded-full object-cover" /> : item.key === "default" ? <Home className="h-5 w-5" /> : <span className="text-base">{item.emoji}</span>}
                <span>{item.labelKey ? t(item.labelKey) : item.label}</span>
              </button>
            ))}
          </div>
        </SettingCard>
      </SectionGroup>

      {/* ═══ Palette ═══ */}
      <SectionGroup title={t("settings.palette_title")}>
        <SettingCard>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.palette_accent")}</p>
            <div className="grid grid-cols-9 gap-1.5">
              {ACCENT_OPTIONS.map((a) => (
                <button key={a.value} onClick={() => setPaletteAccent(a.value)}
                  className={cn(
                    "h-5 rounded transition-all duration-150",
                    "ring-1 ring-white/10 hover:ring-white/30",
                    paletteAccent === a.value
                      ? "ring-2 ring-white shadow-lg scale-105"
                      : "hover:scale-105"
                  )}
                  style={{ background: a.value }} title={t(a.i18nKey)} />
              ))}
            </div>
          </div>
          <SliderControl title={t("settings.palette_saturation")} value={paletteSaturation} onChange={setPaletteSaturation} min={0} max={100} />
          <button onClick={() => resetPaletteToTheme(theme)} className="text-xs text-gray-500 hover:text-primary-light transition-colors">
            <RotateCcw className="h-3 w-3 inline mr-1" />{t("settings.palette_reset")}
          </button>
        </SettingCard>
      </SectionGroup>

      {/* ═══ Layout ═══ */}
      <SectionGroup title={t("settings.look_display")}>
        <SettingCard>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.bg_video")}</p>
            <div className="grid grid-cols-4 gap-2">
              {(["contain", "cover", "fill", "none"] as BgVideoMode[]).map((mode) => (
                <button key={mode} onClick={() => setBgVideoMode(mode)}
                  className={cn("px-3 py-2 rounded-lg text-xs border transition-all",
                    bgVideoMode === mode ? "bg-primary/15 border-primary/40 text-primary-light" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                  {t(`settings.bg_${mode}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.dashboard_mode")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["full", "strip"] as const).map((m) => (
                <button key={m} onClick={() => setDashboardMode(m)}
                  className={cn("px-3 py-2 rounded-lg text-xs border transition-all",
                    dashboardMode === m ? "bg-primary/15 border-primary/40 text-primary-light" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                  {t(`settings.dashboard_${m === "full" ? "normal" : "strip"}`)}
                </button>
              ))}
            </div>
          </div>
          <CardDivider />
          <SettingRow label={t("settings.auto_hide_header")}><Toggle active={autoHideHeader} onToggle={() => setAutoHideHeader(!autoHideHeader)} /></SettingRow>
          <CardDivider />
          <SettingRow label={t("settings.auto_hide_footer")}><Toggle active={autoHideFooter} onToggle={() => setAutoHideFooter(!autoHideFooter)} /></SettingRow>
        </SettingCard>
      </SectionGroup>

      {/* ═══ Glass Effect ═══ */}
      <SectionGroup title={t("settings.glass_title")}>
        <SettingCard>
          <SettingRow label={t("settings.glass_master")} hint={t("settings.glass_master_hint")}>
            <Toggle active={glassMasterEnabled} onToggle={() => setGlassMasterEnabled(!glassMasterEnabled)} />
          </SettingRow>
          {glassMasterEnabled ? (
            <>
              <CardDivider />
              <SliderControl title={t("settings.global_opacity")} value={globalGlassOpacity} onChange={setGlobalGlassOpacity} min={0} max={100} unit="%" />
              <SliderControl title={t("settings.global_blur")} value={globalGlassBlur} onChange={setGlobalGlassBlur} min={0} max={40} unit="px" />
            </>
          ) : (
            <>
              <CardDivider />
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t("settings.glass_bars")}</p>
              <SliderControl title={t("settings.bar_opacity")} value={barOpacity} onChange={setBarOpacity} min={0} max={100} unit="%" />
              <SliderControl title={t("settings.bar_blur")} value={barBlur} onChange={setBarBlur} min={0} max={40} unit="px" />
              <CardDivider />
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t("settings.glass_main")}</p>
              <SliderControl title={t("settings.main_opacity")} value={mainOpacity} onChange={setMainOpacity} min={0} max={100} unit="%" />
              <SliderControl title={t("settings.main_blur")} value={mainBlur} onChange={setMainBlur} min={0} max={40} unit="px" />
              <CardDivider />
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t("settings.glass_dialog")}</p>
              <SliderControl title={t("settings.dialog_opacity")} value={dialogOpacity} onChange={setDialogOpacity} min={0} max={100} unit="%" />
              <SliderControl title={t("settings.dialog_blur")} value={dialogBlur} onChange={setDialogBlur} min={0} max={40} unit="px" />
            </>
          )}
        </SettingCard>
      </SectionGroup>

      {/* ═══ Font ═══ */}
      <SectionGroup title={t("settings.look_font")}>
        <SettingCard>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.font_family")}</p>
            <div className="grid grid-cols-2 gap-2">
              {FONT_LIST.map((f) => (
                <button key={f.value} onClick={() => setFontFamily(f.value)}
                  className={cn("px-3 py-2 rounded-lg text-xs border transition-all text-left truncate",
                    fontFamily === f.value ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                  {f.i18nKey ? t(f.i18nKey) : f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.font_size")}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["small", "normal", "large"] as FontSize[]).map((v) => (
                <button key={v} onClick={() => setFontSize(v)}
                  className={cn("px-3 py-2 rounded-lg text-xs border transition-all",
                    fontSize === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                  {v === "small" ? t("settings.font_size_s") : v === "normal" ? t("settings.font_size_m") : t("settings.font_size_l")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.icon_size")}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["normal", "medium", "large"] as IconSize[]).map((v) => (
                <button key={v} onClick={() => setIconSize(v)}
                  className={cn("px-3 py-2 rounded-lg text-xs border transition-all",
                    iconSize === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                  {v === "normal" ? t("settings.icon_size_s") : v === "medium" ? t("settings.icon_size_m") : t("settings.icon_size_l")}
                </button>
              ))}
            </div>
          </div>
        </SettingCard>
      </SectionGroup>

      {/* ═══ Wallpaper ═══ */}
      {theme === "default" && <SectionGroup title={t("settings.wallpaper_title")}><WallpaperSection t={t} /></SectionGroup>}

      {/* ═══ Theme packs ═══ */}
      <SectionGroup title={t("settings.theme_plugins")}><ThemeManager /></SectionGroup>

      {/* ═══ Dev tools ═══ */}
      {import.meta.env?.VITE_LICENSE_TIER && (
        <SectionGroup title={t("settings.dev_tools")}>
          <div className="flex gap-2 flex-wrap">
            <NavigationStudioBtn t={t} />
            <BgTunerBtn />
          </div>
        </SectionGroup>
      )}

      <ResetButton tab="appearance" t={t} onReset={resetTab} />
    </>
  );
}

// ═══════════════ MEDIA TAB ═══════════════

function MediaTab(props: any) {
  const { t, previewOffset, setPreviewOffset, lyricFontSize, setLyricFontSize, lyricUseCustomColor, setLyricUseCustomColor, lyricCurrentColor, setLyricCurrentColor, lyricOtherColor, setLyricOtherColor, lyricFillColor, setLyricFillColor, playerBgMode, playerBgColor, setPlayerBgMode, setPlayerBgColor, cyberBgmEnabled, setCyberBgmEnabled, imageWheelMode, setImageWheelMode, resetTab } = props;
  return (
    <>
      {/* ═══ Lyrics ═══ */}
      <SectionGroup title={t("settings.lyric_type")}>
        <SettingCard>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.lyric_display")}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["normal", "large", "off"] as const).map((v) => (
                <button key={v} onClick={() => setLyricFontSize(v)}
                  className={cn("px-3 py-2 rounded-lg text-xs border transition-all",
                    lyricFontSize === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                  {v === "normal" ? t("settings.lyric_normal") : v === "large" ? t("settings.lyric_large") : t("settings.lyric_off")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.lyric_preview")}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{t("settings.lyric_offset")}</span>
              <input type="number" step="0.1" min="0" max="5" value={previewOffset}
                onChange={(e) => setPreviewOffset(Number(parseFloat(e.target.value) || 0))}
                className="w-24 rounded-lg border border-white/5 bg-surface-light px-3 py-1.5 text-xs text-gray-300" />
            </div>
          </div>
          <CardDivider />
          <div>
            <SettingRow label={t("settings.lyric_color_title")}>
              <Toggle active={lyricUseCustomColor} onToggle={() => setLyricUseCustomColor(!lyricUseCustomColor)} />
            </SettingRow>
            {lyricUseCustomColor && (
              <div className="mt-3 space-y-3 pl-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-20">{t("settings.lyric_current_color")}</span>
                  <ColorInput value={lyricCurrentColor} onChange={setLyricCurrentColor} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-20">{t("settings.lyric_other_color")}</span>
                  <ColorInput value={lyricOtherColor} onChange={setLyricOtherColor} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-20">{t("settings.lyric_fill_color")}</span>
                  <ColorInput value={lyricFillColor} onChange={setLyricFillColor} />
                </div>
              </div>
            )}
          </div>
        </SettingCard>
      </SectionGroup>

      {/* ═══ Player ═══ */}
      <SectionGroup title={t("settings.player_bg_title")}>
        <SettingCard>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.player_bg_mode_label")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["follow", "custom"] as const).map((v) => (
                <button key={v} onClick={() => setPlayerBgMode(v)}
                  className={cn("px-3 py-2 rounded-lg text-xs border transition-all",
                    playerBgMode === v ? "bg-primary/15 border-primary/40 text-primary-light" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                  {t(`settings.player_bg_${v}`)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-2">{t("settings.player_bg_hint")}</p>
          </div>
          <CardDivider />
          <SettingRow label={t("settings.cyber_bgm_desc")}><Toggle active={cyberBgmEnabled} onToggle={() => setCyberBgmEnabled(!cyberBgmEnabled)} /></SettingRow>
        </SettingCard>
      </SectionGroup>

      {/* ═══ Images ═══ */}
      <SectionGroup title={t("settings.images_title")}>
        <SettingCard>
          <div>
            <p className="text-xs text-gray-400 mb-2">{t("settings.image_wheel")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["prevNext", "zoom"] as ImageWheelMode[]).map((v) => (
                <button key={v} onClick={() => setImageWheelMode(v)}
                  className={cn("px-3 py-2 rounded-lg text-xs border transition-all",
                    imageWheelMode === v ? "bg-primary/15 border-primary/40 text-primary-light" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                  {t(`settings.image_wheel_${v}`)}
                </button>
              ))}
            </div>
          </div>
        </SettingCard>
      </SectionGroup>

      {/* ═══ External Player ═══ */}
      <SectionGroup title={t("player.title")}>
        <ExternalPlayerSection />
      </SectionGroup>

      <ResetButton tab="media" t={t} onReset={resetTab} />
    </>
  );
}

// ═══════════════ WIDGETS TAB ═══════════════

function WidgetsTab(props: any) {
  const { t, myComputer, systemMonitor, clock, calendar, countdown, setEnabled, setPosition, setMyComputerMode, setCountdown, widgetTextColor, setWidgetTextColor, resetTab } = props;
  return (
    <>
      <SectionGroup title={t("settings.widgets_config")}>
        <div className="space-y-3">
          <WidgetCard icon={Monitor} title={t("settings.my_computer")} enabled={myComputer.enabled} onToggle={() => setEnabled("myComputer", !myComputer.enabled)}>
            {myComputer.enabled && <>
              <PositionSelect value={myComputer.position} onChange={(v: any) => setPosition("myComputer", v)} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{t("settings.open_with")}</span>
                <select value={myComputer.myComputerMode || "default"} onChange={(e) => setMyComputerMode(e.target.value as "default" | "custom")}
                  className="rounded-lg border border-white/5 bg-surface-light px-3 py-1.5 text-xs text-gray-300">
                  <option value="default">{t("settings.windows_default")}</option>
                  <option value="custom">{t("settings.theme_custom")}</option>
                </select>
              </div>
            </>}
          </WidgetCard>
          <WidgetCard icon={Cpu} title={t("settings.system_monitor")} enabled={systemMonitor.enabled} onToggle={() => setEnabled("systemMonitor", !systemMonitor.enabled)}>
            {systemMonitor.enabled && <PositionSelect value={systemMonitor.position} onChange={(v: any) => setPosition("systemMonitor", v)} />}
          </WidgetCard>
          <WidgetCard icon={Clock} title={t("settings.clock")} enabled={clock.enabled} onToggle={() => setEnabled("clock", !clock.enabled)}>
            {clock.enabled && <PositionSelect value={clock.position} onChange={(v: any) => setPosition("clock", v)} />}
          </WidgetCard>
          <WidgetCard icon={Calendar} title={t("settings.calendar")} enabled={calendar.enabled} onToggle={() => setEnabled("calendar", !calendar.enabled)}>
            {calendar.enabled && <PositionSelect value={calendar.position} onChange={(v: any) => setPosition("calendar", v)} />}
          </WidgetCard>
          <WidgetCard icon={Timer} title={t("widget.countdown")} enabled={countdown.enabled} onToggle={() => setCountdown({ enabled: !countdown.enabled })}>
            {countdown.enabled && <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{t("widget.countdown_display_mode")}</span>
                <div className="flex gap-2">
                  {(["full", "mini"] as const).map((m) => (
                    <button key={m} onClick={() => setCountdown({ displayMode: m })}
                      className={cn("px-2.5 py-1 rounded text-xs transition-colors", countdown.displayMode === m ? "bg-primary/20 text-primary-light" : "text-gray-400 hover:text-white")}>
                      {t(`widget.countdown_${m}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
                <input type="number" min="0" max="23" value={countdown.hours} onChange={(e) => setCountdown({ hours: Number(e.target.value) })}
                  className="w-11 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span>{t("widget.countdown_hours")}</span>
                <input type="number" min="0" max="59" value={countdown.minutes} onChange={(e) => setCountdown({ minutes: Number(e.target.value) })}
                  className="w-11 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span>{t("widget.countdown_minutes")}</span>
                <input type="number" min="0" max="59" value={countdown.seconds} onChange={(e) => setCountdown({ seconds: Number(e.target.value) })}
                  className="w-11 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span>{t("widget.countdown_seconds")}</span>
                <span className="w-2" />
                <span>{t("widget.countdown_loop")}</span>
                <input type="number" min="0" max="99" value={countdown.loopCount} onChange={(e) => setCountdown({ loopCount: Number(e.target.value) })}
                  className="w-11 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span className="text-gray-500">{countdown.loopCount === 0 ? t("widget.countdown_unlimited") : t("widget.countdown_times")}</span>
                <span className="w-2" />
                <span>{t("widget.countdown_voice_interval")}</span>
                <input type="number" min="30" max="600" value={countdown.voiceInterval ?? 30} onChange={(e) => setCountdown({ voiceInterval: Math.max(30, Number(e.target.value) || 30) })}
                  className="w-12 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span className="text-gray-500">{t("widget.countdown_sec")}</span>
              </div>
              <PositionSelect value={countdown.position} onChange={(v: any) => setCountdown({ position: v })} />
              <SettingRow label={t("widget.countdown_glow")}><Toggle active={countdown.alertGlow} onToggle={() => setCountdown({ alertGlow: !countdown.alertGlow })} /></SettingRow>
              <SettingRow label={t("widget.countdown_voice")}><Toggle active={countdown.alertVoice} onToggle={() => setCountdown({ alertVoice: !countdown.alertVoice })} /></SettingRow>
            </>}
          </WidgetCard>
        </div>
      </SectionGroup>

      <SectionGroup title={t("settings.widget_appearance")}>
        <SettingCard>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{t("settings.widget_text_color")}</span>
            <input type="color" value={widgetTextColor} onChange={(e: any) => setWidgetTextColor(e.target.value)}
              className="h-8 w-12 rounded border border-white/5 cursor-pointer bg-transparent p-0.5" />
            <span className="text-xs text-gray-400 font-mono">{widgetTextColor}</span>
          </div>
        </SettingCard>
      </SectionGroup>

      <ResetButton tab="widgets" t={t} onReset={resetTab} />
    </>
  );
}

// ═══════════════ PERFORMANCE TAB ═══════════════

function PerformanceTab(props: any) {
  const { t, perfPriority, setPerfPriority, perfIdleReduce, setPerfIdleReduce, perfReduceAnimations, setPerfReduceAnimations, cacheCleanupDays, setCacheCleanupDays, hardwareAcceleration, setHardwareAcceleration, applyPerfSettings, resetTab } = props;
  const [cleanState, setCleanState] = useState<"" | "running" | "done">("");
  const [cleanResult, setCleanResult] = useState("");

  const handleCleanup = async () => {
    setCleanState("running"); setCleanResult("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const r = await invoke<{ deleted: number; freedBytes: number }>("cleanup_invalid_covers");
      if (r.deleted === 0) setCleanResult(t("settings.perf_cleanup_none"));
      else { const mb = (r.freedBytes / (1024 * 1024)).toFixed(1); setCleanResult(t("settings.perf_cleanup_done", { n: r.deleted, size: mb })); }
    } catch (e) { setCleanResult(`${t("settings.perf_cleanup_fail")}: ${e}`); }
    setCleanState("done");
    setTimeout(() => { setCleanState(""); setCleanResult(""); }, 5000);
  };

  return (
    <>
      <SectionGroup title={t("settings.hardware_accel")}>
        <SettingCard>
          <SettingRow label={t("settings.hardware_accel_toggle")} hint={t("settings.hardware_accel_hint")}>
            <Toggle active={hardwareAcceleration} onToggle={() => setHardwareAcceleration(!hardwareAcceleration)} />
          </SettingRow>
        </SettingCard>
      </SectionGroup>

      <SectionGroup title={t("settings.perf_priority")}>
        <SettingCard>
          <div className="grid grid-cols-3 gap-3">
            {(["normal", "above_normal", "high"] as const).map((v) => (
              <button key={v} onClick={() => { setPerfPriority(v); setTimeout(() => applyPerfSettings(), 0); }}
                className={cn("px-3 py-3 rounded-lg text-xs border transition-all",
                  perfPriority === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
                {t(`settings.perf_priority_${v}`)}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-500">{t("settings.perf_priority_hint")}</p>
        </SettingCard>
      </SectionGroup>

      <SectionGroup title={t("settings.perf_tuning")}>
        <SettingCard>
          <SettingRow label={t("settings.perf_reduce_animations")} hint={t("settings.perf_reduce_animations_hint")}>
            <Toggle active={perfReduceAnimations} onToggle={() => setPerfReduceAnimations(!perfReduceAnimations)} />
          </SettingRow>
          <CardDivider />
          <SettingRow label={t("settings.perf_idle_reduce")} hint={t("settings.perf_idle_reduce_hint")}>
            <Toggle active={perfIdleReduce} onToggle={() => setPerfIdleReduce(!perfIdleReduce)} />
          </SettingRow>
        </SettingCard>
      </SectionGroup>

      <SectionGroup title={t("settings.perf_cache_cleanup")}>
        <SettingCard>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{t("settings.perf_cache_cleanup_interval")}</span>
              <select value={cacheCleanupDays} onChange={(e) => setCacheCleanupDays(Number(e.target.value))}
                className="h-8 rounded-lg border border-white/10 bg-surface-dark px-2 text-xs text-gray-200">
                <option value={7}>7{t("settings.perf_cache_cleanup_days")}</option>
                <option value={15}>15{t("settings.perf_cache_cleanup_days")}</option>
                <option value={30}>30{t("settings.perf_cache_cleanup_days")}</option>
                <option value={60}>60{t("settings.perf_cache_cleanup_days")}</option>
                <option value={0}>{t("settings.perf_cache_cleanup_never")}</option>
              </select>
            </div>
            <button onClick={handleCleanup} disabled={cleanState === "running"}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:bg-white/5 transition-colors disabled:opacity-50">
              {cleanState === "running" ? "..." : t("settings.perf_cleanup_now")}
            </button>
          </div>
          {cleanResult && <p className={cn("text-[10px] mt-2", cleanResult.includes("fail") ? "text-red-400" : "text-green-400")}>{cleanResult}</p>}
          <p className="text-[10px] text-gray-500">{t("settings.perf_cache_cleanup_hint")}</p>
        </SettingCard>
      </SectionGroup>

      <ResetButton tab="performance" t={t} onReset={resetTab} />
    </>
  );
}

// ═══════════════ SHARED SECTION COMPONENTS ═══════════════

function LicenseSection({ t }: { t: any }) {
  const { license, openActivation, unbind } = useLicenseStore();
  const [unbindOpen, setUnbindOpen] = useState(false);
  const [unbinding, setUnbinding] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const tier = license.tier;

  const tierLabel = (tier: string) => {
    if (tier === "free") return t("license.free");
    if (tier === "member") return t("license.member");
    return tier;
  };

  const expiryInfo = (): { text: string; expired: boolean } => {
    if (license.duration === "permanent") return { text: t("license.permanent"), expired: false };
    if (!license.expiresAt) return { text: "", expired: false };
    const diff = new Date(license.expiresAt).getTime() - Date.now();
    if (diff <= 0) return { text: t("license.expired"), expired: true };
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days > 1) return { text: t("license.remaining_days", { n: days }), expired: false };
    const h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const s = Math.floor((diff % (60 * 1000)) / 1000);
    return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, expired: false };
  };

  const exp = expiryInfo();
  const activatedDate = license.activatedAt
    ? new Date(license.activatedAt).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
    : null;

  const handleUnbind = async () => { setUnbinding(true); try { await unbind(); setUnbindOpen(false); } catch (e) { alert(t("license.unbind_failed", { error: String(e) })); } setUnbinding(false); };

  return (
    <div>
      <div className="rounded-xl border border-white/5 p-4" style={{ background: "color-mix(in srgb, var(--color-primary) 4%, transparent)" }}>
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          {tier === "free" ? <Key className="h-5 w-5 text-gray-500 shrink-0" /> : <Crown className="h-5 w-5 text-primary-light shrink-0" />}
          <div className="shrink-0">
            <p className="text-sm font-medium text-white leading-tight">{tierLabel(tier)}</p>
            {tier !== "free" && <p className={cn("text-[10px] font-mono leading-tight", exp.expired ? "text-red-400" : "text-gray-500")}>{exp.text}</p>}
          </div>
          {tier !== "free" && <div className="w-px h-6 bg-white/10 shrink-0" />}
          {tier !== "free" && activatedDate && <span className="text-[10px] text-gray-500 shrink-0">{t("license.activated_at")}：{activatedDate}</span>}
          {tier !== "free" && license.code && <div className="w-px h-6 bg-white/10 shrink-0" />}
          {tier !== "free" && license.code && (
            <>
              <span className="text-[10px] text-gray-500 shrink-0">{t("license.code")}：</span>
              <code className="text-[11px] text-gray-300 font-mono tracking-wider select-all truncate">
                {showCode ? license.code : `${license.code!.slice(0, 4)}····-····-····-${license.code!.slice(-4)}`}
              </code>
              <button onClick={() => setShowCode(!showCode)} className="p-1 rounded hover:bg-white/10 transition-colors shrink-0" title={showCode ? t("license.hide_code") : t("license.show_code")}>
                {showCode ? <Eye className="h-3.5 w-3.5 text-gray-500" /> : <EyeOff className="h-3.5 w-3.5 text-gray-500" />}
              </button>
              {showCode && (
                <button onClick={async () => { try { await navigator.clipboard.writeText(license.code!); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); } catch { const ta = document.createElement("textarea"); ta.value = license.code!; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); } }}
                  className="p-1 rounded hover:bg-white/10 transition-colors shrink-0" title={t("license.copy_code")}>
                  {codeCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-gray-500" />}
                </button>
              )}
            </>
          )}
          <div className="flex-1" />
          {tier === "free" ? (
            <button onClick={openActivation} className="px-3 py-1.5 rounded-lg border border-primary/40 text-primary-light text-xs font-medium hover:bg-primary/10 transition-colors shrink-0">{t("license.enter_code")}</button>
          ) : (
            <button onClick={() => setUnbindOpen(true)} className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 text-xs font-medium hover:bg-white/5 transition-colors shrink-0">{t("license.unbind")}</button>
          )}
        </div>
      </div>
      {unbindOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setUnbindOpen(false)}>
          <div className="rounded-2xl border border-white/10 p-6 max-w-sm mx-4 shadow-2xl" style={{ background: "color-mix(in srgb, var(--color-primary) 8%, #0c1420)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-3">{t("license.unbind_title")}</h3>
            <p className="text-xs text-gray-300 mb-3">{t("license.unbind_warning")}</p>
            <div className="text-[11px] text-gray-400 space-y-1 mb-5 leading-relaxed">
              <p>{t("license.unbind_note_countdown")}</p><p>{t("license.unbind_note_cooldown")}</p><p>{t("license.unbind_note_cap")}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setUnbindOpen(false)} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 text-xs hover:text-white transition-colors">{t("license.unbind_cancel")}</button>
              <button onClick={handleUnbind} disabled={unbinding} className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50">{unbinding ? "..." : t("license.unbind_confirm_btn")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataSection({ t }: { t: any }) {
  const [expBusy, setExpBusy] = useState(false); const [impBusy, setImpBusy] = useState(false); const [msg, setMsg] = useState("");
  const handleExport = async () => {
    setExpBusy(true); setMsg("");
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const dest = await save({ defaultPath: "media-library-backup.zip", filters: [{ name: "ZIP", extensions: ["zip"] }] });
      if (!dest) { setExpBusy(false); return; }
      try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("export_data", { destPath: dest }); setMsg(t("settings.data_export_ok")); } catch { setMsg(t("settings.data_export_fail")); }
    } catch { setMsg(t("settings.data_export_fail")); }
    setExpBusy(false); setTimeout(() => setMsg(""), 5000);
  };
  const handleImport = async () => {
    setImpBusy(true); setMsg("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const src = await open({ multiple: false, filters: [{ name: "ZIP", extensions: ["zip"] }] });
      if (!src) { setImpBusy(false); return; }
      try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("import_data", { srcPath: src as string }); setMsg(t("settings.data_import_ok")); } catch { setMsg(t("settings.data_import_fail")); }
    } catch { setMsg(t("settings.data_import_fail")); }
    setImpBusy(false);
  };
  return (
    <SettingCard>
      <p className="text-xs text-gray-500">{t("settings.data_manage_desc")}</p>
      <div className="flex gap-2">
        <button onClick={handleExport} disabled={expBusy} className="px-3 py-1.5 rounded-lg text-xs border border-primary text-primary-light hover:bg-primary/10 transition-colors disabled:opacity-40">{expBusy ? "..." : t("settings.data_export")}</button>
        <button onClick={handleImport} disabled={impBusy} className="px-3 py-1.5 rounded-lg text-xs border border-primary text-primary-light hover:bg-primary/10 transition-colors disabled:opacity-40">{impBusy ? "..." : t("settings.data_import")}</button>
      </div>
      {msg && <p className="text-xs text-primary-light">{msg}</p>}
    </SettingCard>
  );
}

function FeedbackSection({ t }: { t: any }) {
  const [message, setMessage] = useState(""); const [sent, setSent] = useState(false);
  const handleSubmit = async () => {
    if (!message.trim()) return;
    const title = encodeURIComponent("[Feedback] " + message.slice(0, 80));
    const body = encodeURIComponent(message);
    const url = `https://github.com/cyber2079/nova-media-manager/issues/new?title=${title}&body=${body}`;
    try { const { open } = await import("@tauri-apps/plugin-shell"); await open(url); } catch { window.open(url, "_blank"); }
    setMessage(""); setSent(true); setTimeout(() => setSent(false), 3000);
  };
  return (
    <SettingCard>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("settings.feedback_placeholder")} rows={3}
        className="w-full rounded-lg border border-white/5 bg-surface-lighter px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-primary-light" />
      <button onClick={handleSubmit} disabled={!message.trim()}
        className="px-4 py-1.5 rounded-lg text-xs bg-primary/20 text-primary-light hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        {sent ? "✓" : t("settings.feedback_send")}
      </button>
    </SettingCard>
  );
}

function ExternalPlayerSection() {
  const { t } = useTranslation();
  const externalPlayer = useSettingsStore((s) => s.externalPlayer);
  const setExternalPlayer = useSettingsStore((s) => s.setExternalPlayer);
  const [detected, setDetected] = useState<{ kind: string; name: string; path: string }[]>([]);
  const [detecting, setDetecting] = useState(false);
  const detect = useCallback(async () => {
    setDetecting(true);
    try { const { invoke } = await import("@tauri-apps/api/core"); const players = await invoke<{ kind: string; name: string; path: string }[]>("detect_external_players"); setDetected(players || []); } catch { setDetected([]); }
    setDetecting(false);
  }, []);
  useEffect(() => { detect(); }, [detect]);
  const pickCustom = async () => { try { const { open } = await import("@tauri-apps/plugin-dialog"); const sel = await open({ multiple: false, filters: [{ name: t("player.filter_name"), extensions: ["exe"] }] }); if (typeof sel === "string") setExternalPlayer({ kind: "custom", path: sel }); } catch {} };
  const modes: { v: "auto" | "always" | "never"; label: string; desc: string }[] = [
    { v: "auto", label: t("player.mode_auto"), desc: t("player.mode_auto_desc") },
    { v: "always", label: t("player.mode_always"), desc: t("player.mode_always_desc") },
    { v: "never", label: t("player.mode_never"), desc: t("player.mode_never_desc") },
  ];
  return (
    <SettingCard>
      <p className="text-xs text-gray-500">{t("player.description")}</p>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button key={m.v} onClick={() => setExternalPlayer({ mode: m.v })}
            className={cn("px-3 py-2.5 rounded-lg text-left border transition-all", externalPlayer.mode === m.v ? "bg-primary/15 border-primary/40" : "border-transparent hover:bg-surface-lighter")}>
            <p className={cn("text-xs font-semibold", externalPlayer.mode === m.v ? "text-primary-light" : "text-gray-300")}>{m.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{m.desc}</p>
          </button>
        ))}
      </div>
      {externalPlayer.mode !== "never" && (
        <>
          <div className="space-y-1.5">
            {detected.map((p) => (
              <button key={p.kind} onClick={() => setExternalPlayer({ kind: p.kind, path: p.path })}
                className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all",
                  externalPlayer.path === p.path ? "bg-primary/15 border-primary/40" : "border-transparent hover:bg-surface-lighter")}>
                <span className={cn("text-xs font-medium shrink-0", externalPlayer.path === p.path ? "text-primary-light" : "text-gray-300")}>{p.name}</span>
                <span className="flex-1 text-[10px] text-gray-500 truncate" dir="rtl">{p.path}</span>
                {externalPlayer.path === p.path && <span className="text-primary-light text-xs shrink-0">✓</span>}
              </button>
            ))}
            {!detecting && detected.length === 0 && <p className="text-xs text-gray-500 px-1">{t("player.no_detected")}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={detect} disabled={detecting} className="text-xs">{detecting ? t("player.detecting") : t("player.redetect")}</Button>
            <Button variant="outline" size="sm" onClick={pickCustom} className="text-xs">{t("player.choose_exe")}</Button>
          </div>
          {externalPlayer.kind === "custom" && externalPlayer.path && <p className="text-[10px] text-gray-500 truncate">{t("player.custom_path", { path: externalPlayer.path })}</p>}
        </>
      )}
    </SettingCard>
  );
}

function WallpaperSection({ t }: { t: any }) {
  const wallpaper = useSettingsStore((s: any) => s.wallpaper);
  const setWallpaperConfig = useSettingsStore((s: any) => s.setWallpaperConfig);
  const pickFile = async () => { try { const { open } = await import("@tauri-apps/plugin-dialog"); const selected = await open({ multiple: false, filters: [{ name: "Images", extensions: ["webp","jpg","jpeg","png","bmp","gif"] }] }); if (selected) setWallpaperConfig({ mode: "single", path: selected as string }); } catch (e) { console.error("[wallpaper]", e); } };
  const pickFolder = async () => { try { const { open } = await import("@tauri-apps/plugin-dialog"); const selected = await open({ directory: true, multiple: false }); if (selected) setWallpaperConfig({ mode: "folder", path: selected as string }); } catch (e) { console.error("[wallpaper]", e); } };
  return (
    <SettingCard>
      <div className="flex gap-2">
        <button onClick={() => setWallpaperConfig({ mode: "none" })} className={cn("flex-1 py-1.5 rounded-lg text-xs border transition-colors", wallpaper.mode === "none" ? "bg-primary/15 border-primary/40 text-primary-light" : "border-white/5 text-gray-400 hover:text-white")}>{t("settings.wallpaper_off")}</button>
        <button onClick={pickFile} className={cn("flex-1 py-1.5 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1", wallpaper.mode === "single" ? "bg-primary/15 border-primary/40 text-primary-light" : "border-white/5 text-gray-400 hover:text-white")}><ImageIcon className="h-3 w-3" /> {t("settings.wallpaper_single")}</button>
        <button onClick={pickFolder} className={cn("flex-1 py-1.5 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1", wallpaper.mode === "folder" ? "bg-primary/15 border-primary/40 text-primary-light" : "border-white/5 text-gray-400 hover:text-white")}><FolderOpen className="h-3 w-3" /> {t("settings.wallpaper_folder")}</button>
      </div>
      {(wallpaper.mode !== "none" && wallpaper.path) ? <div className="text-[10px] text-gray-500 truncate font-mono bg-white/[0.02] px-2 py-1 rounded">{wallpaper.path}</div> : null}
      {wallpaper.mode === "folder" && (<>
        <SettingRow label={t("settings.wallpaper_shuffle")}><Toggle active={wallpaper.shuffle === "random"} onToggle={() => setWallpaperConfig({ shuffle: wallpaper.shuffle === "random" ? "sequential" : "random" })} /></SettingRow>
        <SliderControl title={t("settings.wallpaper_interval")} value={wallpaper.interval} onChange={(v) => setWallpaperConfig({ interval: v })} min={5} max={300} unit="s" />
      </>)}
    </SettingCard>
  );
}

// ═══════════════ REUSABLE WIDGETS ═══════════════

function ResetButton({ tab, t, onReset }: { tab: string; t: (k: string, options?: Record<string, unknown>) => string; onReset: () => void }) {
  return (
    <div className="pt-2 border-t border-white/5">
      <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs text-gray-400">
        <RotateCcw className="h-3 w-3" />{t("settings.reset_tab", { tab: t(`settings.tab_${tab}`) })}
      </Button>
    </div>
  );
}

function WidgetCard({ icon: Icon, title, enabled, onToggle, children }: { icon: typeof Monitor; title: string; enabled: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 p-4 space-y-3 bg-white/[0.01]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5"><Icon className="h-4 w-4 text-primary-light" /><span className="text-sm font-medium text-white">{title}</span></div>
        <Toggle active={enabled} onToggle={onToggle} />
      </div>
      {children}
    </div>
  );
}

function Toggle({ active, disabled, onToggle }: { active: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button role="switch" aria-checked={active} disabled={disabled} onClick={onToggle}
      className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
        active ? "bg-primary-light" : "bg-surface-lighter")}>
      <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200",
        active ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}

function PositionSelect({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{t("settings.position")}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-white/5 bg-surface-light px-3 py-1.5 text-xs text-gray-300">
        <option value="bottom-left">{t("settings.pos_bl")}</option>
        <option value="bottom-right">{t("settings.pos_br")}</option>
        <option value="center-left">{t("settings.pos_cl")}</option>
        <option value="center-right">{t("settings.pos_cr")}</option>
        <option value="top-left">{t("settings.pos_tl")}</option>
        <option value="top-right">{t("settings.pos_tr")}</option>
      </select>
    </div>
  );
}

function SliderControl({ title, value, onChange, min, max, unit }: { title: string; value: number; onChange: (v: number) => void; min: number; max: number; unit?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400">{title}</span>
        <span className="text-xs text-gray-500 font-mono">{value}{unit || ""}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer rounded-full appearance-none bg-white/10" style={{ accentColor: "var(--color-primary)" }} />
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 rounded border border-white/5 cursor-pointer bg-transparent p-0.5" />
      <span className="text-xs text-gray-400 font-mono">{value}</span>
    </div>
  );
}

function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: { message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm" style={{ background: "color-mix(in srgb, var(--color-primary) 6%, rgba(8,12,20,0.94))" }}>
        <p className="text-sm text-gray-300">{message}</p>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>{t("settings.cancel")}</Button>
          <Button variant="ghost" size="sm" onClick={onConfirm} className="text-red-400">{confirmLabel || t("settings.confirm_reset")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════ DEV TOOLS ═══════════════

function NavigationStudioBtn({ t }: { t: any }) {
  return (
    <a href="/studio" className="px-3 py-2 rounded-lg border border-primary/30 text-xs text-primary-light hover:bg-primary/10 transition-colors flex items-center gap-1.5">
      <Sparkles className="h-3.5 w-3.5" />{t("settings.theme_studio")}
    </a>
  );
}

function BgTunerBtn() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <>
      <button onClick={() => setShow(true)} className="px-3 py-2 rounded-lg border border-primary/30 text-xs text-gray-300 hover:bg-primary/10 transition-colors flex items-center gap-1.5">
        <SlidersHorizontal className="h-3.5 w-3.5" />{t("settings.bg_tuner")}
      </button>
      {show && <BgVideoTuner visible={show} onToggle={() => setShow(false)} />}
    </>
  );
}
