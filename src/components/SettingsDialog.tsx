import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useThemeStore, useAvailableThemes, type ThemeName } from "@/stores/themeStore";
import { kv } from "@/lib/sqliteStore";
import { useSettingsStore, applySurface, FONT_LIST, type BgVideoMode, type FontSize, type IconSize, type ImageWheelMode } from "@/stores/settingsStore";
import { languages } from "@/i18n";
import { cn } from "@/lib/utils";
import ScrollFade from "@/components/ScrollFade";
import ThemeManager from "@/components/ThemeManager";
import { Palette, EyeOff, Eye, Copy, Monitor, Cpu, Clock, Calendar, Settings, SlidersHorizontal, Music, Image, Film, Gamepad2, RotateCcw, Timer, Sun, Moon, Key, Crown, FolderOpen, ImageIcon, Shuffle, Home, Check, Gauge } from "lucide-react";
import { ThemeAssets } from "@/lib/themeBase";
import { useLicenseStore } from "@/stores/licenseStore";
import { ACCENT_OPTIONS, THEME_PALETTE_DEFAULTS, type WallpaperFit } from "@/stores/settingsStore";
import { useWidgetStore, pageKeys } from "@/stores/widgetStore";
import type { PageKey } from "@/stores/widgetStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const themeList: { key: ThemeName; labelKey: string; emoji: string; image?: string }[] = [
  { key: "default", labelKey: "settings.theme_default", emoji: "🏠" },
  { key: "ice-girl", labelKey: "settings.theme_ice", emoji: "❄️", image: ThemeAssets.ice.head },
  { key: "cyber-girl", labelKey: "settings.theme_cg", emoji: "💜", image: ThemeAssets.cg.bg },
];

type TabId = "general" | "appearance" | "music" | "images" | "movies" | "games" | "widgets" | "performance" | "themes";

const tabs: { id: TabId; icon: typeof Settings; labelKey: string }[] = [
  { id: "general", icon: SlidersHorizontal, labelKey: "settings.tab_general" },
  { id: "appearance", icon: Palette, labelKey: "settings.tab_appearance" },
  { id: "music", icon: Music, labelKey: "settings.tab_music" },
  { id: "images", icon: Image, labelKey: "settings.tab_images" },
  { id: "movies", icon: Film, labelKey: "settings.tab_movies" },
  { id: "games", icon: Gamepad2, labelKey: "settings.tab_games" },
  { id: "widgets", icon: Monitor, labelKey: "settings.tab_widgets" },
  { id: "performance", icon: Gauge, labelKey: "settings.tab_performance" },
];

// ── Default values (used by reset) ──
const DEFAULTS = {
  general: { language: "zh", autoStart: true, startFullscreen: true, autoHideHeader: false, autoHideFooter: false, hideTitleBar: true },
  appearance: { theme: "path-of-exile" as ThemeName, bgVideoMode: "fill" as BgVideoMode, fontSize: "normal" as FontSize, fontFamily: "inter", paletteAccent: "#4788f0", paletteSaturation: 50, paletteContrast: "dark" as const, paletteCustomized: false },
  music: { previewOffset: 0.5, lyricFontSize: "normal" as const, lyricUseCustomColor: false as const, lyricCurrentColor: "#ffffff", lyricOtherColor: "#8899aa", lyricFillColor: "#ffb6c1", playerBgMode: "follow" as const, playerBgColor: "", cyberBgmEnabled: true },
  images: { imageWheelMode: "prevNext" as ImageWheelMode },
  widgets: {
    globalWidgets: true,
    widgetPages: {} as Record<string, boolean>,
    myComputer: { enabled: true, position: "bottom-left" as const, myComputerMode: "custom" as const },
    systemMonitor: { enabled: true, position: "bottom-right" as const },
    clock: { enabled: true, position: "top-right" as const },
    calendar: { enabled: true, position: "top-left" as const },
    countdown: { enabled: false, position: "center-right" as const, displayMode: "full" as const, hours: 0, minutes: 5, seconds: 0, loopCount: 1, alertGlow: false, alertVoice: true, voiceInterval: 30 }},
  performance: { perfPriority: "normal" as const, perfPowerThrottle: false, perfIdleReduce: true}};


export default function SettingsDialog({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const availableThemes = useAvailableThemes();
  const filteredThemeList = themeList.filter(t => availableThemes.includes(t.key));
  const {
    language, autoStart, startFullscreen, autoHideHeader, autoHideFooter,
    bgVideoMode,
    setLanguage, setAutoStart, setStartFullscreen,
    setAutoHideHeader, setAutoHideFooter, setBgVideoMode,
    previewOffset, setPreviewOffset, lyricFontSize, setLyricFontSize,
    lyricUseCustomColor, setLyricUseCustomColor, lyricCurrentColor, setLyricCurrentColor,
    lyricOtherColor, setLyricOtherColor, lyricFillColor, setLyricFillColor,
    fontSize, iconSize, setFontSize, setIconSize, fontFamily, setFontFamily,
    imageWheelMode, setImageWheelMode,
    headerOpacity, footerOpacity, setHeaderOpacity, setFooterOpacity,
    bgOverlayOpacity, setBgOverlayOpacity,
    hideTitleBar, setHideTitleBar,
    fontPrimaryColor, fontSecondaryColor, widgetTextColor, setFontPrimaryColor, setFontSecondaryColor, setWidgetTextColor,
    scrollFadeOpacity, setScrollFadeOpacity,
    playerBgColor, playerBgMode, setPlayerBgColor, setPlayerBgMode,
    cyberBgmEnabled, setCyberBgmEnabled,
    cgTextSize, cgTextColor, setCgTextSize, setCgTextColor,
    paletteAccent, paletteSaturation, paletteContrast, paletteCustomized, setPaletteAccent, setPaletteSaturation, setPaletteContrast, resetPaletteToTheme,
    dashboardMode, setDashboardMode, hardwareAcceleration, setHardwareAcceleration,
    perfPriority, setPerfPriority, perfPowerThrottle, setPerfPowerThrottle,
    perfIdleReduce, setPerfIdleReduce,
    applyPerfSettings} = useSettingsStore();
  const { myComputer, systemMonitor, clock, calendar, countdown, globalWidgets, widgetPages, setEnabled, setPosition, setMyComputerMode, setGlobalWidgets, setPageWidget, setCountdown } = useWidgetStore();
  const [autoLoading, setAutoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [confirmReset, setConfirmReset] = useState<"all" | TabId | null>(null);
  const loadedRef = useRef(false);

  if (open && !loadedRef.current) {
    loadedRef.current = true;
    (async () => {
      try {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        const on = await isEnabled();
        if (on !== autoStart) {
          useSettingsStore.setState({ autoStart: on });
        }
      } catch {}
    })();
  }
  if (!open) loadedRef.current = false;

  const handleLanguage = (code: string) => {
    setLanguage(code);
    i18n.changeLanguage(code);
    localStorage.setItem("app-lang", code);
    kv.set("app-lang", code).catch(() => {});
  };

  const handleAutoStart = async () => {
    setAutoLoading(true);
    await setAutoStart(!autoStart);
    setAutoLoading(false);
  };

  const handleTheme = (t: ThemeName) => {
    setTheme(t);
  };

  // ── Reset logic ──
  const doResetTab = useCallback((tab: TabId) => {
    switch (tab) {
      case "general": {
        const d = DEFAULTS.general;
        setLanguage(d.language);
        i18n.changeLanguage(d.language);
        localStorage.setItem("app-lang", d.language);
        kv.set("app-lang", d.language).catch(() => {});
        setAutoStart(d.autoStart);
        setStartFullscreen(d.startFullscreen);
        setAutoHideHeader(d.autoHideHeader);
        setAutoHideFooter(d.autoHideFooter);
        setHideTitleBar(d.hideTitleBar);
        break;
      }
      case "appearance": {
        const d = DEFAULTS.appearance;
        setTheme(d.theme);
        setBgVideoMode(d.bgVideoMode);
        setFontSize(d.fontSize);
        setFontFamily(d.fontFamily);
        setPaletteAccent(d.paletteAccent);
        setPaletteSaturation(d.paletteSaturation);
        setPaletteContrast(d.paletteContrast);
        setTimeout(() => applySurface(), 0);
        break;
      }
      case "music": {
        setPreviewOffset(DEFAULTS.music.previewOffset);
        setLyricFontSize(DEFAULTS.music.lyricFontSize);
        setLyricUseCustomColor(DEFAULTS.music.lyricUseCustomColor);
        setLyricCurrentColor(DEFAULTS.music.lyricCurrentColor);
        setLyricOtherColor(DEFAULTS.music.lyricOtherColor);
        setLyricFillColor(DEFAULTS.music.lyricFillColor);
        setPlayerBgMode("follow");
        setPlayerBgColor("");
        setCyberBgmEnabled(DEFAULTS.music.cyberBgmEnabled);
        break;
      }
      case "images": {
        setImageWheelMode(DEFAULTS.images.imageWheelMode);
        break;
      }
      case "widgets": {
        const d = DEFAULTS.widgets;
        setGlobalWidgets(d.globalWidgets);
        for (const k of pageKeys) setPageWidget(k as PageKey, d.widgetPages[k] ?? false);
        setEnabled("myComputer", d.myComputer.enabled);
        setPosition("myComputer", d.myComputer.position);
        setMyComputerMode(d.myComputer.myComputerMode);
        setEnabled("systemMonitor", d.systemMonitor.enabled);
        setPosition("systemMonitor", d.systemMonitor.position);
        setEnabled("clock", d.clock.enabled);
        setPosition("clock", d.clock.position);
        setEnabled("calendar", d.calendar.enabled);
        setPosition("calendar", d.calendar.position);
        setCountdown(d.countdown);
        break;
      }
      case "performance": {
        const d = DEFAULTS.performance;
        setPerfPriority(d.perfPriority);
        setPerfPowerThrottle(d.perfPowerThrottle);
        setPerfIdleReduce(d.perfIdleReduce);
        
        applyPerfSettings();
        break;
      }
    }
    setConfirmReset(null);
  }, [setLanguage, i18n, setAutoStart, setStartFullscreen, setAutoHideHeader, setAutoHideFooter,
      setTheme, setBgVideoMode, setFontSize, setFontFamily, setHideTitleBar,
      setPaletteAccent, setPaletteSaturation, setPaletteContrast,
      setPreviewOffset, setLyricFontSize, setLyricUseCustomColor, setLyricCurrentColor, setLyricOtherColor, setLyricFillColor, setImageWheelMode,
      setGlobalWidgets, setPageWidget, setEnabled, setPosition, setMyComputerMode, setCountdown,
      setPerfPriority, setPerfPowerThrottle, setPerfIdleReduce, applyPerfSettings]);

  const doResetAll = useCallback(() => {
    for (const tab of tabs) doResetTab(tab.id);
    setConfirmReset(null);
  }, [doResetTab]);

  const isCG = theme === "cyber-girl";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl overflow-hidden flex flex-col p-0 gap-0 rounded-2xl" style={{
        height: "65vh", maxHeight: "85vh",
        background: isCG ? "color-mix(in srgb, var(--color-primary) 6%, rgba(8,2,20,0.94))" : "color-mix(in srgb, var(--color-primary) 6%, rgba(8,12,20,0.94))",
        border: isCG ? "1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)" : undefined,
        boxShadow: isCG ? "0 0 40px color-mix(in srgb, var(--color-primary) 12%, transparent), 0 0 80px color-mix(in srgb, var(--color-accent) 6%, transparent)" : undefined}}>
        {/* Header */}
        <div className={cn("relative flex items-center justify-between px-6 pt-5 pb-3 border-b",
          isCG ? "border-[var(--color-primary)]/15" : "border-white/5")}>
          <DialogTitle className={cn(isCG && "cg-text-glow")}>{t("settings.title")}</DialogTitle>
        </div>

        {/* Body: left tabs + right content */}
        <div className="flex flex-1 min-h-0 relative">
          {/* Left tab sidebar */}
          <div className={cn("w-40 shrink-0 py-4 px-3 flex flex-col gap-1 overflow-y-auto border-r",
            isCG ? "border-[var(--color-primary)]/15" : "border-white/5")}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 text-left",
                    isCG
                      ? cn("rounded-r-lg border-l-2 -ml-3 pl-6",
                          isActive
                            ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-primary-light cg-text-glow"
                            : "border-transparent text-gray-400 hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,transparent)] hover:text-gray-200")
                      : cn("rounded-lg",
                          isActive
                            ? "bg-primary/15 text-primary-light"
                            : "text-gray-400 hover:bg-surface-lighter/50 hover:text-gray-200")
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>

          {/* Right content area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7 relative">
            {/* ═══ General Tab ═══ */}
            {activeTab === "general" && (
              <>
                <LicenseSection t={t} />
                <LanguageSection {...{ t, language, handleLanguage, languages }} />
                <StartupSection {...{ t, autoStart, autoLoading, handleAutoStart, startFullscreen, setStartFullscreen }} />
                <DataSection t={t} />
                <FeedbackSection t={t} />
                <ResetButton tab="general" t={t} onReset={() => setConfirmReset("general")} />
              </>
            )}

            {/* ═══ Appearance Tab ═══ */}
            {activeTab === "appearance" && (
              <>
                <ThemeSection {...{ t, theme, themeList: filteredThemeList, handleTheme }} />

                {/* ── Palette ── */}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.palette_title")}</h4>
                  <div className="space-y-4">
                    {/* Accent */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">{t("settings.palette_accent")}</p>
                      <div className="flex gap-2 flex-wrap">
                        {ACCENT_OPTIONS.map((a) => (
                          <button key={a.value} onClick={() => setPaletteAccent(a.value)}
                            className={cn("w-8 h-8 rounded-full border-2 transition-all",
                              paletteAccent === a.value ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105")}
                            style={{ background: a.value }} title={t(a.i18nKey)} />
                        ))}
                      </div>
                    </div>
                    {/* Saturation */}
                    <SliderSection title={t("settings.palette_saturation")} value={paletteSaturation}
                      onChange={setPaletteSaturation} min={0} max={100} />
                    {/* Contrast */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">{t("settings.palette_contrast")}</p>
                      <div className="flex gap-2">
                        <button onClick={() => setPaletteContrast("dark")}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
                            paletteContrast === "dark" ? "bg-white/10 border-white/30 text-white" : "border-white/5 text-gray-400 hover:text-gray-200")}>
                          <Moon className="h-3 w-3" /> {t("settings.palette_dark")}</button>
                        <button onClick={() => setPaletteContrast("light")}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
                            paletteContrast === "light" ? "bg-white/10 border-white/30 text-white" : "border-white/5 text-gray-400 hover:text-gray-200")}>
                          <Sun className="h-3 w-3" /> {t("settings.palette_light")}</button>
                      </div>
                    </div>
                    {/* Reset button */}
                    <button onClick={() => resetPaletteToTheme(theme)}
                      className="text-xs text-gray-500 hover:text-primary-light transition-colors">{t("settings.palette_reset")}</button>
                  </div>
                </section>

                {/* ── Font ── */}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.look_font")}</h4>
                  <div className="space-y-3">
                    <FontFamilySection {...{ t, fontFamily, setFontFamily }} />
                    <FontSection {...{ t, fontSize, setFontSize }} />
                    <IconSection {...{ t, iconSize, setIconSize }} />
                  </div>
                </section>

                {/* ── Display ── */}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.look_display")}</h4>
                  <div className="space-y-3">
                    <BgModeSection {...{ t, bgVideoMode, setBgVideoMode }} />
                    <ToggleRow label={t("settings.hide_title_bar")} active={hideTitleBar} onToggle={() => setHideTitleBar(!hideTitleBar)} hint={t("settings.hide_title_bar_hint")} />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={autoHideHeader} onChange={(e) => setAutoHideHeader(e.target.checked)} className="h-4 w-4 rounded accent-[var(--color-primary)]" />
                      <span className="text-sm text-gray-300">{t("settings.auto_hide_header")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={autoHideFooter} onChange={(e) => setAutoHideFooter(e.target.checked)} className="h-4 w-4 rounded accent-[var(--color-primary)]" />
                      <span className="text-sm text-gray-300">{t("settings.auto_hide_footer")}</span>
                    </label>
                    <div>
                      <p className="text-xs text-gray-400 mb-2">{t("settings.dashboard_mode")}</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDashboardMode("full")}
                          className={cn("px-3 py-1.5 text-xs rounded-md border transition-colors",
                            dashboardMode === "full" ? "bg-white/10 border-white/30 text-white" : "border-white/5 text-gray-400 hover:text-gray-200")}>
                          {t("settings.dashboard_normal")}</button>
                        <button onClick={() => setDashboardMode("strip")}
                          className={cn("px-3 py-1.5 text-xs rounded-md border transition-colors",
                            dashboardMode === "strip" ? "bg-white/10 border-white/30 text-white" : "border-white/5 text-gray-400 hover:text-gray-200")}>
                          {t("settings.dashboard_strip")}</button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── Wallpaper (default theme only) ── */}
                {theme === "default" && <WallpaperSection t={t} />}

                {/* ── Theme Packs ── */}
                <ThemeManager />

                <ResetButton tab="appearance" t={t} onReset={() => setConfirmReset("appearance")} />
              </>
            )}

            {/* ═══ Music Tab ═══ */}
            {activeTab === "music" && (
              <>
                <LyricSection {...{ t, previewOffset, setPreviewOffset, lyricFontSize, setLyricFontSize, lyricUseCustomColor, setLyricUseCustomColor, lyricCurrentColor, setLyricCurrentColor, lyricOtherColor, setLyricOtherColor, lyricFillColor, setLyricFillColor }} />
                <PlayerBgSection {...{ t, playerBgMode, playerBgColor, setPlayerBgMode, setPlayerBgColor }} />
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("settings.cyber_bgm")}</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cyberBgmEnabled}
                      onChange={(e) => setCyberBgmEnabled(e.target.checked)}
                      className="h-4 w-4 rounded accent-[var(--color-primary)]"
                    />
                    <span className="text-sm text-gray-300">{t("settings.cyber_bgm_desc")}</span>
                  </label>
                </section>
                <ResetButton tab="music" t={t} onReset={() => setConfirmReset("music")} />
              </>
            )}

            {/* ═══ Images Tab ═══ */}
            {activeTab === "images" && (
              <>
                <ImageWheelSection {...{ t, imageWheelMode, setImageWheelMode }} />
                <ResetButton tab="images" t={t} onReset={() => setConfirmReset("images")} />
              </>
            )}

            {/* ═══ Movies Tab ═══ */}
            {activeTab === "movies" && <ExternalPlayerSection />}

            {/* ═══ Games Tab ═══ */}
            {activeTab === "games" && (
              <section><p className="text-sm text-gray-500">{t("settings.placeholder_games")}</p></section>
            )}

            {/* ═══ Performance Tab ═══ */}
            {activeTab === "performance" && (
              <PerformanceSection {...{ t, perfPriority, setPerfPriority, perfPowerThrottle, setPerfPowerThrottle, perfIdleReduce, setPerfIdleReduce, hardwareAcceleration, setHardwareAcceleration, applyPerfSettings }}>
                <ResetButton tab="performance" t={t} onReset={() => setConfirmReset("performance")} />
              </PerformanceSection>
            )}

            {/* ═══ Widgets Tab ═══ */}
            {activeTab === "widgets" && (
              <WidgetsSection {...{ t, globalWidgets, setGlobalWidgets, widgetPages, setPageWidget, myComputer, systemMonitor, clock, calendar, countdown, setEnabled, setPosition, setMyComputerMode, setCountdown, widgetTextColor, setWidgetTextColor }}>
                <ResetButton tab="widgets" t={t} onReset={() => setConfirmReset("widgets")} />
              </WidgetsSection>
            )}
            <ScrollFade height={48} />
          </div>
        </div>

        {/* Footer */}
        <div className={cn("relative px-6 py-3 border-t flex items-center gap-2",
          isCG ? "border-[var(--color-primary)]/15" : "border-white/5")}>
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            {t("settings.close")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset("all")} className="gap-1.5 text-gray-400">
            <RotateCcw className="h-3.5 w-3.5" />{t("settings.reset_defaults")}
          </Button>
        </div>
      </DialogContent>

      {/* ── Confirm reset dialog ── */}
      {confirmReset && (
        <ConfirmDialog
          message={confirmReset === "all" ? t("settings.confirm_reset_all") : t("settings.confirm_reset_tab", { tab: t(`settings.tab_${confirmReset}`) })}
          onConfirm={() => { if (confirmReset === "all") doResetAll(); else doResetTab(confirmReset); }}
          onCancel={() => setConfirmReset(null)}
        />
      )}
    </Dialog>
  );
}

// ── Confirm Dialog ──
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm" style={{ background: "color-mix(in srgb, var(--color-primary) 6%, rgba(8,12,20,0.94))" }}>
        <p className="text-sm text-gray-300">{message}</p>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>{t("settings.cancel")}</Button>
          <Button variant="ghost" size="sm" onClick={onConfirm} className="text-red-400">{t("settings.confirm_reset")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Extracted section components ──

function ResetButton({ tab, t, onReset }: { tab: string; t: (k: string, options?: Record<string, unknown>) => string; onReset: () => void }) {
  return (
    <div className="pt-2 border-t border-white/5">
      <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs text-gray-400">
        <RotateCcw className="h-3 w-3" />{t("settings.reset_tab", { tab: t(`settings.tab_${tab}`) })}
      </Button>
    </div>
  );
}

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

  const pricingLabel = () => {
    if (license.duration === "monthly") return t("license.member_price_monthly");
    if (license.duration === "yearly") return t("license.member_price_yearly");
    if (license.duration === "permanent") return t("license.member_price_permanent");
    return "";
  };

  // ── 剩余天数 / 已过期 ──
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

  // ── 激活日期 ──
  const activatedDate = license.activatedAt
    ? new Date(license.activatedAt).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
    : null;

  const handleUnbind = async () => {
    setUnbinding(true);
    try {
      await unbind();
      setUnbindOpen(false);
    } catch (e) {
      alert(t("license.unbind_failed", { error: String(e) }));
    }
    setUnbinding(false);
  };

  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {t("license.title")}
      </h4>
      <div className="p-4 rounded-xl border border-white/5"
        style={{ background: "color-mix(in srgb, var(--color-primary) 4%, transparent)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tier === "free" ? (
              <Key className="h-5 w-5 text-gray-500" />
            ) : (
              <Crown className="h-5 w-5 text-primary-light" />
            )}
            <div>
              <p className="text-sm font-medium text-white">
                {tierLabel(tier)}
                {tier !== "free" && (
                  <span className="ml-1.5 text-[11px] text-gray-400 font-normal">
                    {pricingLabel()}
                  </span>
                )}
              </p>
              {tier !== "free" && (
                <p className={cn("text-[11px] mt-0.5 font-mono", exp.expired ? "text-red-400" : "text-gray-500")}>
                  {exp.text}
                </p>
              )}
            </div>
          </div>
          {tier === "free" ? (
            <button
              onClick={openActivation}
              className="px-3 py-1.5 rounded-lg border border-primary/40 text-primary-light text-xs font-medium hover:bg-primary/10 transition-colors"
            >
              {t("license.enter_code")}
            </button>
          ) : (
            <button
              onClick={() => setUnbindOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 text-xs font-medium hover:bg-white/5 transition-colors"
            >
              {t("license.unbind")}
            </button>
          )}
        </div>
        {/* ── 激活日期 ── */}
        {tier !== "free" && activatedDate && (
          <p className="text-[10px] text-gray-500 mt-2">
            {t("license.activated_at")}：{activatedDate}
          </p>
        )}
        {/* ── 授权码 ── */}
        {tier !== "free" && license.code && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
            <span className="text-[10px] text-gray-500 shrink-0">{t("license.code")}：</span>
            <code className="text-[11px] text-gray-300 font-mono tracking-wider select-all">
              {showCode ? license.code : "····-····-····-····"}
            </code>
            <button
              onClick={() => setShowCode(!showCode)}
              className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
              title={showCode ? t("license.hide_code") : t("license.show_code")}
            >
              {showCode ? (
                <Eye className="h-3.5 w-3.5 text-gray-500" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-gray-500" />
              )}
            </button>
            {showCode && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(license.code!);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  } catch {
                    // fallback
                    const ta = document.createElement("textarea");
                    ta.value = license.code!;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }
                }}
                className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                title={t("license.copy_code")}
              >
                {codeCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-gray-500" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 解绑确认弹窗 ── */}
      {unbindOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setUnbindOpen(false)}>
          <div className="rounded-2xl border border-white/10 p-6 max-w-sm mx-4 shadow-2xl"
            style={{ background: "color-mix(in srgb, var(--color-primary) 8%, #0c1420)" }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-3">{t("license.unbind_title")}</h3>
            <p className="text-xs text-gray-300 mb-3">{t("license.unbind_warning")}</p>
            <div className="text-[11px] text-gray-400 space-y-1 mb-5 leading-relaxed">
              <p>{t("license.unbind_note_countdown")}</p>
              <p>{t("license.unbind_note_cooldown")}</p>
              <p>{t("license.unbind_note_cap")}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setUnbindOpen(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 text-xs hover:text-white transition-colors"
              >
                {t("license.unbind_cancel")}
              </button>
              <button
                onClick={handleUnbind}
                disabled={unbinding}
                className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {unbinding ? "..." : t("license.unbind_confirm_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FeedbackSection({ t }: { t: any }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    // Open default browser with a pre-filled GitHub issue
    const title = encodeURIComponent("[Feedback] " + message.slice(0, 80));
    const body = encodeURIComponent(message);
    const url = `https://github.com/your-org/your-repo/issues/new?title=${title}&body=${body}`;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch {
      window.open(url, "_blank");
    }
    setMessage("");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("settings.feedback")}</h4>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("settings.feedback_placeholder")}
        rows={3}
        className="w-full rounded-lg border border-primary bg-surface-lighter px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-primary-light"
      />
      <button
        onClick={handleSubmit}
        disabled={!message.trim()}
        className="mt-2 px-4 py-1.5 rounded-lg text-xs bg-primary/20 text-primary-light hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {sent ? "✓" : t("settings.feedback_send")}
      </button>
    </section>
  );
}

function HardwareAccelSection({ t, hardwareAcceleration, setHardwareAcceleration }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("settings.hardware_accel")}</h4>
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hardwareAcceleration}
            onChange={(e) => setHardwareAcceleration(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--color-primary)]"
          />
          <span className="text-sm text-gray-300">{t("settings.hardware_accel_toggle")}</span>
        </label>
        <p className="text-[10px] text-gray-500">{t("settings.hardware_accel_hint")}</p>
      </div>
    </section>
  );
}

function PerformanceSection({ t, perfPriority, setPerfPriority, perfPowerThrottle, setPerfPowerThrottle, perfIdleReduce, setPerfIdleReduce, hardwareAcceleration, setHardwareAcceleration, applyPerfSettings, children }: any) {
  return (
    <div className="space-y-7">
      {/* ── GPU 硬件加速 ── */}
      <HardwareAccelSection {...{ t, hardwareAcceleration, setHardwareAcceleration }} />

      {/* ── 进程优先级 ── */}
      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.perf_priority")}</h4>
        <div className="grid grid-cols-3 gap-3">
          {(["normal", "above_normal", "high"] as const).map((v) => (
            <button key={v} onClick={() => { setPerfPriority(v); setTimeout(() => applyPerfSettings(), 0); }}
              className={cn("px-3 py-3 rounded-lg text-xs border transition-all duration-200",
                perfPriority === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
              {t(`settings.perf_priority_${v}`)}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2">{t("settings.perf_priority_hint")}</p>
      </section>

      {/* ── 电源节流 ── */}
      <section>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={perfPowerThrottle}
            onChange={(e) => { setPerfPowerThrottle(e.target.checked); setTimeout(() => applyPerfSettings(), 0); }}
            className="h-4 w-4 rounded accent-[var(--color-primary)]"
          />
          <span className="text-sm text-gray-300">{t("settings.perf_power_throttle")}</span>
        </label>
        <p className="text-[10px] text-gray-500 mt-1.5 ml-6">{t("settings.perf_power_throttle_hint")}</p>
      </section>

      {/* ── 空闲降载 ── */}
      <section>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={perfIdleReduce}
            onChange={(e) => setPerfIdleReduce(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--color-primary)]"
          />
          <span className="text-sm text-gray-300">{t("settings.perf_idle_reduce")}</span>
        </label>
        <p className="text-[10px] text-gray-500 mt-1.5 ml-6">{t("settings.perf_idle_reduce_hint")}</p>
      </section>

      {children}
    </div>
  );
}

function DataSection({ t }: { t: any }) {
  const [expBusy, setExpBusy] = useState(false);
  const [impBusy, setImpBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const handleExport = async () => {
    setExpBusy(true); setMsg("");
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const dest = await save({
        defaultPath: "media-library-backup.zip",
        filters: [{ name: "ZIP", extensions: ["zip"] }]});
      if (!dest) { setExpBusy(false); return; }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("export_data", { destPath: dest });
        setMsg(t("settings.data_export_ok"));
      } catch { setMsg(t("settings.data_export_fail")); }
    } catch { setMsg(t("settings.data_export_fail")); }
    setExpBusy(false);
    setTimeout(() => setMsg(""), 5000);
  };

  const handleImport = async () => {
    setImpBusy(true); setMsg("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const src = await open({
        multiple: false,
        filters: [{ name: "ZIP", extensions: ["zip"] }]});
      if (!src) { setImpBusy(false); return; }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("import_data", { srcPath: src as string });
        setMsg(t("settings.data_import_ok"));
      } catch { setMsg(t("settings.data_import_fail")); }
    } catch { setMsg(t("settings.data_import_fail")); }
    setImpBusy(false);
  };

  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("settings.data_manage")}</h4>
      <p className="text-xs text-gray-500 mb-3">{t("settings.data_manage_desc")}</p>
      <div className="flex gap-2">
        <button onClick={handleExport} disabled={expBusy}
          className="px-3 py-1.5 rounded-lg text-xs border border-primary text-primary-light hover:bg-primary/10 transition-colors disabled:opacity-40">
          {expBusy ? "..." : t("settings.data_export")}
        </button>
        <button onClick={handleImport} disabled={impBusy}
          className="px-3 py-1.5 rounded-lg text-xs border border-primary text-primary-light hover:bg-primary/10 transition-colors disabled:opacity-40">
          {impBusy ? "..." : t("settings.data_import")}
        </button>
      </div>
      {msg && <p className="text-xs text-primary-light mt-2">{msg}</p>}
    </section>
  );
}

function LanguageSection({ t, language, handleLanguage, languages }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.language")}</h4>
      <div className="grid grid-cols-2 gap-3">
        {languages.map((lang: any) => (
          <button key={lang.code} onClick={() => handleLanguage(lang.code)}
            className={cn("text-left px-4 py-3 rounded-lg text-sm transition-all duration-200 border",
              language === lang.code ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
            {lang.i18nKey ? t(lang.i18nKey) : lang.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function StartupSection({ t, autoStart, autoLoading, handleAutoStart, startFullscreen, setStartFullscreen }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.startup")}</h4>
      <div className="space-y-4">
        <ToggleRow label={t("settings.auto_launch")} active={autoStart} disabled={autoLoading} onToggle={handleAutoStart} />
        <ToggleRow label={t("settings.start_fullscreen")} active={startFullscreen} onToggle={() => setStartFullscreen(!startFullscreen)} />
              </div>
    </section>
  );
}

function ThemeSection({ t, theme, themeList, handleTheme }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.theme")}</h4>
      <div className="grid grid-cols-3 gap-3">
        {themeList.map((item: any) => (
          <button key={item.key} onClick={() => handleTheme(item.key)}
            className={cn("flex flex-col items-center gap-2 px-3 py-4 rounded-lg text-xs border transition-all duration-200",
              theme === item.key ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
            {item.image ? <img src={item.image} alt="" className="w-14 h-14 rounded-full object-cover" /> : item.key === "default" ? <Home className="h-7 w-7" /> : <span className="text-xl">{item.emoji}</span>}
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function BgModeSection({ t, bgVideoMode, setBgVideoMode }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.bg_video")}</h4>
      <div className="grid grid-cols-3 gap-3">
        {(["normal", "fill", "stretch"] as BgVideoMode[]).map((mode) => (
          <button key={mode} onClick={() => setBgVideoMode(mode)}
            className={cn("px-3 py-3 rounded-lg text-xs border transition-all duration-200",
              bgVideoMode === mode ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
            {t(`settings.bg_${mode}`)}
          </button>
        ))}
      </div>
    </section>
  );
}

function FontSection({ t, fontSize, setFontSize }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.font_size")}</h4>
      <div className="grid grid-cols-3 gap-3">
        {(["small", "normal", "large"] as FontSize[]).map((v) => (
          <button key={v} onClick={() => setFontSize(v)}
            className={cn("px-3 py-3 rounded-lg text-xs border transition-all duration-200",
              fontSize === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
            {v === "small" ? t("settings.font_size_s") : v === "normal" ? t("settings.font_size_m") : t("settings.font_size_l")}
          </button>
        ))}
      </div>
    </section>
  );
}

function IconSection({ t, iconSize, setIconSize }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.icon_size")}</h4>
      <div className="grid grid-cols-3 gap-3">
        {(["normal", "medium", "large"] as IconSize[]).map((v) => (
          <button key={v} onClick={() => setIconSize(v)}
            className={cn("px-3 py-3 rounded-lg text-xs border transition-all duration-200",
              iconSize === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
            {v === "normal" ? t("settings.icon_size_s") : v === "medium" ? t("settings.icon_size_m") : t("settings.icon_size_l")}
          </button>
        ))}
      </div>
    </section>
  );
}

function HeaderFooterOpacitySection({ t, headerOpacity, setHeaderOpacity, footerOpacity, setFooterOpacity }: any) {
  return (
    <>
      <SliderSection title={t("settings.header_opacity")} value={headerOpacity} onChange={setHeaderOpacity} min={0} max={100} unit="%" />
      <SliderSection title={t("settings.footer_opacity")} value={footerOpacity} onChange={setFooterOpacity} min={0} max={100} unit="%" />
    </>
  );
}

function FontColorSection({ t, fontPrimaryColor, fontSecondaryColor, setFontPrimaryColor, setFontSecondaryColor }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.font_colors")}</h4>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-gray-400 mb-2">{t("settings.font_primary")}{t("settings.font_primary_note")}</p>
          <div className="flex items-center gap-3">
            <input type="color" value={fontPrimaryColor} onChange={(e) => setFontPrimaryColor(e.target.value)}
              className="h-8 w-12 rounded border border-white/5 cursor-pointer bg-transparent p-0.5" />
            <span className="text-xs text-gray-400 font-mono">{fontPrimaryColor}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-2">{t("settings.font_secondary")}{t("settings.font_secondary_note")}</p>
          <div className="flex items-center gap-3">
            <input type="color" value={fontSecondaryColor} onChange={(e) => setFontSecondaryColor(e.target.value)}
              className="h-8 w-12 rounded border border-white/5 cursor-pointer bg-transparent p-0.5" />
            <span className="text-xs text-gray-400 font-mono">{fontSecondaryColor}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderSection({ title, value, onChange, min, max, unit }: { title: string; value: number; onChange: (v: number) => void; min: number; max: number; unit?: string }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-gray-400 mb-2">{title}</h4>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 cursor-pointer" style={{ accentColor: "var(--color-primary)" }} />
        <span className="text-xs text-gray-400 w-10 text-right">{value}{unit || ""}</span>
      </div>
    </div>
  );
}

function LyricSection({ t, previewOffset, setPreviewOffset, lyricFontSize, setLyricFontSize, lyricUseCustomColor, setLyricUseCustomColor, lyricCurrentColor, setLyricCurrentColor, lyricOtherColor, setLyricOtherColor, lyricFillColor, setLyricFillColor }: any) {
  return (
    <>
      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.lyric_type")}</h4>
        <div className="grid grid-cols-3 gap-3">
          {(["normal", "large", "off"] as const).map((v) => (
            <button key={v} onClick={() => setLyricFontSize(v)}
              className={cn("px-3 py-3 rounded-lg text-xs border transition-all duration-200",
                lyricFontSize === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
              {v === "normal" ? t("settings.lyric_normal") : v === "large" ? t("settings.lyric_large") : t("settings.lyric_off")}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.lyric_preview")}</h4>
        <div className="mt-2">
          <label className="text-sm text-gray-300 block mb-2">{t("settings.lyric_offset")}</label>
          <input type="number" step="0.1" min="0" max="5" value={previewOffset}
            onChange={(e) => setPreviewOffset(Number(parseFloat(e.target.value) || 0))}
            className="w-40 rounded-lg border border-white/5 bg-surface-light px-3 py-1.5 text-xs text-gray-300" />
        </div>
      </section>
      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>{t("settings.lyric_color_title")}</span>
          <Toggle active={lyricUseCustomColor} onToggle={() => setLyricUseCustomColor(!lyricUseCustomColor)} />
        </h4>
        {lyricUseCustomColor && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t("settings.lyric_current_color")}</p>
              <ColorInput value={lyricCurrentColor} onChange={setLyricCurrentColor} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t("settings.lyric_other_color")}</p>
              <ColorInput value={lyricOtherColor} onChange={setLyricOtherColor} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t("settings.lyric_fill_color")}</p>
              <ColorInput value={lyricFillColor} onChange={setLyricFillColor} />
            </div>
          </div>
        )}
      </section>
    </>
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

function PlayerBgSection({ t, playerBgMode, playerBgColor, setPlayerBgMode, setPlayerBgColor }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.player_bg_title")}</h4>
      <div className="grid grid-cols-2 gap-3">
        {(["follow", "custom"] as const).map((v) => (
          <button key={v} onClick={() => setPlayerBgMode(v)}
            className={cn("px-3 py-3 rounded-lg text-xs border transition-all duration-200",
              playerBgMode === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
            {t(`settings.player_bg_${v}`)}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 mt-2">{t("settings.player_bg_hint")}</p>
    </section>
  );
}

function ImageWheelSection({ t, imageWheelMode, setImageWheelMode }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.image_wheel")}</h4>
      <div className="grid grid-cols-2 gap-3">
        {(["prevNext", "zoom"] as ImageWheelMode[]).map((v) => (
          <button key={v} onClick={() => setImageWheelMode(v)}
            className={cn("px-3 py-3 rounded-lg text-xs border transition-all duration-200",
              imageWheelMode === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
            {t(`settings.image_wheel_${v}`)}
          </button>
        ))}
      </div>
    </section>
  );
}

// ── 外接播放器设置（电影 Tab）──
function ExternalPlayerSection() {
  const { t } = useTranslation();
  const externalPlayer = useSettingsStore((s) => s.externalPlayer);
  const setExternalPlayer = useSettingsStore((s) => s.setExternalPlayer);
  const [detected, setDetected] = useState<{ kind: string; name: string; path: string }[]>([]);
  const [detecting, setDetecting] = useState(false);

  const detect = useCallback(async () => {
    setDetecting(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const players = await invoke<{ kind: string; name: string; path: string }[]>("detect_external_players");
      setDetected(players || []);
    } catch { setDetected([]); }
    setDetecting(false);
  }, []);

  useEffect(() => { detect(); }, [detect]);

  const pickCustom = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const sel = await open({ multiple: false, filters: [{ name: t("player.filter_name"), extensions: ["exe"] }] });
      if (typeof sel === "string") setExternalPlayer({ kind: "custom", path: sel });
    } catch {}
  };

  const modes: { v: "auto" | "always" | "never"; label: string; desc: string }[] = [
    { v: "auto", label: t("player.mode_auto"), desc: t("player.mode_auto_desc") },
    { v: "always", label: t("player.mode_always"), desc: t("player.mode_always_desc") },
    { v: "never", label: t("player.mode_never"), desc: t("player.mode_never_desc") },
  ];

  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("player.title")}</h4>
      <p className="text-xs text-gray-500 mb-4">{t("player.description")}</p>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {modes.map((m) => (
          <button key={m.v} onClick={() => setExternalPlayer({ mode: m.v })}
            className={cn("px-3 py-2.5 rounded-lg text-left border transition-all duration-200",
              externalPlayer.mode === m.v ? "bg-primary/15 border-primary/40" : "border-transparent hover:bg-surface-lighter")}>
            <p className={cn("text-xs font-semibold", externalPlayer.mode === m.v ? "text-primary-light" : "text-gray-300")}>{m.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{m.desc}</p>
          </button>
        ))}
      </div>

      {externalPlayer.mode !== "never" && (
        <>
          <div className="space-y-1.5 mb-3">
            {detected.map((p) => (
              <button key={p.kind} onClick={() => setExternalPlayer({ kind: p.kind, path: p.path })}
                className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all",
                  externalPlayer.path === p.path ? "bg-primary/15 border-primary/40" : "border-transparent hover:bg-surface-lighter")}>
                <span className={cn("text-xs font-medium shrink-0", externalPlayer.path === p.path ? "text-primary-light" : "text-gray-300")}>{p.name}</span>
                <span className="flex-1 text-[10px] text-gray-500 truncate" dir="rtl">{p.path}</span>
                {externalPlayer.path === p.path && <span className="text-primary-light text-xs shrink-0">✓</span>}
              </button>
            ))}
            {!detecting && detected.length === 0 && (
              <p className="text-xs text-gray-500 px-1">{t("player.no_detected")}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={detect} disabled={detecting} className="text-xs">
              {detecting ? t("player.detecting") : t("player.redetect")}
            </Button>
            <Button variant="outline" size="sm" onClick={pickCustom} className="text-xs">{t("player.choose_exe")}</Button>
          </div>
          {externalPlayer.kind === "custom" && externalPlayer.path && (
            <p className="text-[10px] text-gray-500 mt-2 truncate">{t("player.custom_path", { path: externalPlayer.path })}</p>
          )}
        </>
      )}
    </section>
  );
}

function WidgetsSection({ t, globalWidgets, setGlobalWidgets, widgetPages, setPageWidget, myComputer, systemMonitor, clock, calendar, countdown, setEnabled, setPosition, setMyComputerMode, setCountdown, widgetTextColor, setWidgetTextColor, children }: any) {
  return (
    <div className="space-y-7">
      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.widgets_global")}</h4>
        <ToggleRow label={t("settings.widgets_global_desc")} active={globalWidgets} onToggle={() => setGlobalWidgets(!globalWidgets)} />
      </section>
      {!globalWidgets && (
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.widgets_per_page")}</h4>
          <div className="grid grid-cols-2 gap-3">
            {pageKeys.map((p: string) => (
              <label key={p} className="flex items-center justify-between cursor-pointer group bg-surface-lighter/30 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-300">{p === "home" ? t("settings.home_page") : p === "movies" ? t("settings.movies_page") : p === "images" ? t("settings.images_page") : p === "music" ? t("settings.music_page") : t("settings.games_page")}</span>
                <Toggle active={widgetPages[p] || false} onToggle={() => setPageWidget(p as PageKey, !widgetPages[p])} />
              </label>
            ))}
          </div>
        </section>
      )}
      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.widget_text_color")}</h4>
        <div className="flex items-center gap-3 mb-5">
          <input type="color" value={widgetTextColor} onChange={(e: any) => setWidgetTextColor(e.target.value)}
            className="h-8 w-12 rounded border border-white/5 cursor-pointer bg-transparent p-0.5" />
          <span className="text-xs text-gray-400 font-mono">{widgetTextColor}</span>
        </div>
      </section>
      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.widgets_config")}</h4>
        <div className="space-y-4">
          <WidgetCard icon={Monitor} title={t("settings.my_computer")} enabled={myComputer.enabled} onToggle={() => setEnabled("myComputer", !myComputer.enabled)}>
            {myComputer.enabled && <>
              <PositionSelect value={myComputer.position} onChange={(v: any) => setPosition("myComputer", v)} />
              <div className="flex items-center justify-between mt-3">
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

          {/* Countdown */}
          <WidgetCard icon={Timer} title={t("widget.countdown")} enabled={countdown.enabled} onToggle={() => setCountdown({ enabled: !countdown.enabled })}>
            {countdown.enabled && <>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">{t("widget.countdown_display_mode")}</span>
                <div className="flex gap-2">
                  <button onClick={() => setCountdown({ displayMode: "full" })}
                    className={cn("px-2.5 py-1 rounded text-xs transition-colors", countdown.displayMode === "full" ? "bg-primary/20 text-primary-light" : "text-gray-400 hover:text-white")}>{t("widget.countdown_full")}</button>
                  <button onClick={() => setCountdown({ displayMode: "mini" })}
                    className={cn("px-2.5 py-1 rounded text-xs transition-colors", countdown.displayMode === "mini" ? "bg-primary/20 text-primary-light" : "text-gray-400 hover:text-white")}>{t("widget.countdown_mini")}</button>
                </div>
              </div>
              <PositionSelect value={countdown.position} onChange={(v: any) => setCountdown({ position: v })} />
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                <input type="number" min="0" max="23" value={countdown.hours} onChange={(e) => setCountdown({ hours: Number(e.target.value) })}
                  className="w-12 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span>{t("widget.countdown_hours")}</span>
                <input type="number" min="0" max="59" value={countdown.minutes} onChange={(e) => setCountdown({ minutes: Number(e.target.value) })}
                  className="w-12 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span>{t("widget.countdown_minutes")}</span>
                <input type="number" min="0" max="59" value={countdown.seconds} onChange={(e) => setCountdown({ seconds: Number(e.target.value) })}
                  className="w-12 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span>{t("widget.countdown_seconds")}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <span>{t("widget.countdown_loop")}</span>
                <input type="number" min="0" max="99" value={countdown.loopCount} onChange={(e) => setCountdown({ loopCount: Number(e.target.value) })}
                  className="w-14 text-center rounded bg-surface-lighter border border-white/5 py-1 text-xs text-white" />
                <span>{countdown.loopCount === 0 ? t("widget.countdown_unlimited") : t("widget.countdown_times")}</span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-gray-400">
                <p className="text-gray-500">{t("widget.countdown_popup_always")}</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={countdown.alertGlow} onChange={(e) => setCountdown({ alertGlow: e.target.checked })}
                    className="accent-primary-light" />
                  <span className={countdown.alertGlow ? "text-primary-light" : ""}>{t("widget.countdown_glow")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={countdown.alertVoice} onChange={(e) => setCountdown({ alertVoice: e.target.checked })}
                    className="accent-primary-light" />
                  <span className={countdown.alertVoice ? "text-primary-light" : ""}>{t("widget.countdown_voice")}</span>
                </label>
                {countdown.alertVoice && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-gray-500">{t("widget.countdown_voice_interval")}</span>
                    <input type="number" min="30" max="600" value={countdown.voiceInterval ?? 30} onChange={(e) => setCountdown({ voiceInterval: Math.max(30, Number(e.target.value) || 30) })}
                      className="w-14 text-center rounded bg-surface-lighter border border-white/5 py-0.5 text-xs text-white" />
                    <span className="text-gray-500">{t("widget.countdown_sec")}</span>
                  </div>
                )}
              </div>
            </>}
          </WidgetCard>
        </div>
      </section>
      {children}
    </div>
  );
}

/* ── Reusable UI pieces ── */

function ToggleRow({ label, active, disabled, onToggle, icon, hint }: { label: string; active: boolean; disabled?: boolean; onToggle: () => void; icon?: React.ReactNode; hint?: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-gray-300 flex items-center gap-2">
        {icon}{label}
        {hint && <span className="text-[10px] text-gray-500">{hint}</span>}
      </span>
      <Toggle active={active} disabled={disabled} onToggle={onToggle} />
    </label>
  );
}

function WidgetCard({ icon: Icon, title, enabled, onToggle, children }: { icon: typeof Monitor; title: string; enabled: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-primary-light" />
          <span className="text-sm font-medium text-white">{title}</span>
        </div>
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
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/5 bg-surface-light px-3 py-1.5 text-xs text-gray-300">
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

function ScrollFadeSection({ t, scrollFadeOpacity, setScrollFadeOpacity }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.scroll_fade")}</h4>
      <div className="flex items-center gap-3">
        <input type="range" min="0" max="100" value={scrollFadeOpacity} onChange={(e) => setScrollFadeOpacity(Number(e.target.value))}
          className="flex-1 h-2 cursor-pointer" style={{ accentColor: "var(--color-primary)" }} />
        <span className="text-xs text-gray-400 w-10 text-right">{scrollFadeOpacity}%</span>
      </div>
    </section>
  );
}

function FontFamilySection({ t, fontFamily, setFontFamily }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.font_family")}</h4>
      <div className="grid grid-cols-2 gap-2">
        {FONT_LIST.map((f) => {
          const v = f.value, displayLabel = f.i18nKey ? t(f.i18nKey) : f.label;
          return (
            <button key={v} onClick={() => setFontFamily(v)}
              className={cn("px-3 py-2 rounded-lg text-xs border transition-all duration-200 text-left truncate",
                fontFamily === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
              {displayLabel}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WallpaperSection({ t }: { t: any }) {
  const wallpaper = useSettingsStore((s: any) => s.wallpaper);
  const setWallpaperConfig = useSettingsStore((s: any) => s.setWallpaperConfig);

  const pickFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["webp","jpg","jpeg","png","bmp","gif"] }]});
      if (selected) { setWallpaperConfig({ mode: "single", path: selected as string }); }
    } catch (e) { console.error("[wallpaper]", e); }
  };

  const pickFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected) { setWallpaperConfig({ mode: "folder", path: selected as string }); }
    } catch (e) { console.error("[wallpaper]", e); }
  };

  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.wallpaper_title")}</h4>
      <div className="space-y-3">
        <div className="flex gap-2">
          <button onClick={() => setWallpaperConfig({ mode: "none" })}
            className={cn("flex-1 py-1.5 rounded-lg text-xs border transition-colors",
              wallpaper.mode === "none" ? "bg-primary/15 border-primary/40 text-primary-light" : "border-white/5 text-gray-400 hover:text-white")}>
            {t("settings.wallpaper_off")}
          </button>
          <button onClick={pickFile}
            className={cn("flex-1 py-1.5 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1",
              wallpaper.mode === "single" ? "bg-primary/15 border-primary/40 text-primary-light" : "border-white/5 text-gray-400 hover:text-white")}>
            <ImageIcon className="h-3 w-3" /> {t("settings.wallpaper_single")}
          </button>
          <button onClick={pickFolder}
            className={cn("flex-1 py-1.5 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1",
              wallpaper.mode === "folder" ? "bg-primary/15 border-primary/40 text-primary-light" : "border-white/5 text-gray-400 hover:text-white")}>
            <FolderOpen className="h-3 w-3" /> {t("settings.wallpaper_folder")}
          </button>
        </div>
        {(wallpaper.mode !== "none" && wallpaper.path) ? (
          <div className="text-[10px] text-gray-500 truncate font-mono bg-white/[0.02] px-2 py-1 rounded">{wallpaper.path}</div>
        ) : null}
        {wallpaper.mode === "folder" && (<>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{t("settings.wallpaper_slideshow")}</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={wallpaper.shuffle === "random"}
                onChange={(e) => setWallpaperConfig({ shuffle: e.target.checked ? "random" : "sequential" })}
                className="h-4 w-4 rounded accent-[var(--color-primary)]" />
              <span className="text-xs text-gray-300 flex items-center gap-1"><Shuffle className="h-3 w-3" />{t("settings.wallpaper_shuffle")}</span>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 shrink-0">{t("settings.wallpaper_interval")}</span>
            <input type="range" min={5} max={300} value={wallpaper.interval}
              onChange={(e) => setWallpaperConfig({ interval: Number(e.target.value) })}
              className="flex-1 h-1 accent-[var(--color-primary)]" />
            <span className="text-xs text-gray-400 w-10 text-right">{wallpaper.interval}s</span>
          </div>
        </>)}
        {wallpaper.mode !== "none" && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{t("settings.wallpaper_fit")}</span>
            <select value={wallpaper.fit} onChange={(e) => setWallpaperConfig({ fit: e.target.value as WallpaperFit })}
              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none">
              <option value="none">{t("settings.wallpaper_fit_none")}</option>
              <option value="cover">{t("settings.wallpaper_fit_cover")}</option>
              <option value="contain">{t("settings.wallpaper_fit_contain")}</option>
              <option value="fill">{t("settings.wallpaper_fit_fill")}</option>
            </select>
          </div>
        )}
      </div>
    </section>
  );
}
