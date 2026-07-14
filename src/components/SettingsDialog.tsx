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
import { Palette, EyeOff, Monitor, Cpu, Clock, Calendar, Settings, SlidersHorizontal, Music, Image, Film, Gamepad2, RotateCcw, Timer, Sun, Moon, Key, Crown } from "lucide-react";
import { ThemeAssets } from "@/lib/themeBase";
import { useLicenseStore, isPro, isUltra } from "@/stores/licenseStore";
import { ACCENT_OPTIONS, THEME_PALETTE_DEFAULTS } from "@/stores/settingsStore";
import { useWidgetStore, pageKeys } from "@/stores/widgetStore";
import type { PageKey } from "@/stores/widgetStore";
import { openSecondaryDisplay, closeSecondaryDisplay, canUseSecondaryDisplay } from "@/lib/crossWindow";

interface Props {
  open: boolean;
  onClose: () => void;
}

const themeList: { key: ThemeName; labelKey: string; emoji: string; image?: string }[] = [
  { key: "default", labelKey: "settings.theme_default", emoji: "🏠" },
  { key: "ice-girl", labelKey: "settings.theme_ice", emoji: "❄️", image: ThemeAssets.ice.head },
  { key: "cyber-girl", labelKey: "settings.theme_cg", emoji: "💜", image: ThemeAssets.cg.bg },
];

type TabId = "general" | "appearance" | "music" | "images" | "movies" | "games" | "widgets" | "themes";

const tabs: { id: TabId; icon: typeof Settings; labelKey: string }[] = [
  { id: "general", icon: SlidersHorizontal, labelKey: "settings.tab_general" },
  { id: "appearance", icon: Palette, labelKey: "settings.tab_appearance" },
  { id: "music", icon: Music, labelKey: "settings.tab_music" },
  { id: "images", icon: Image, labelKey: "settings.tab_images" },
  { id: "movies", icon: Film, labelKey: "settings.tab_movies" },
  { id: "games", icon: Gamepad2, labelKey: "settings.tab_games" },
  { id: "widgets", icon: Monitor, labelKey: "settings.tab_widgets" },
];

// ── Default values (used by reset) ──
const DEFAULTS = {
  general: { language: "zh", autoStart: true, startFullscreen: true, autoHideHeader: false, autoHideFooter: false, hideTitleBar: true },
  appearance: { theme: "path-of-exile" as ThemeName, bgVideoMode: "fill" as BgVideoMode, fontSize: "normal" as FontSize, fontFamily: "system", paletteAccent: "#4788f0", paletteSaturation: 50, paletteContrast: "dark" as const, paletteCustomized: false },
  music: { previewOffset: 0.5, lyricFontSize: "normal" as const, lyricUseCustomColor: false as const, lyricCurrentColor: "#ffffff", lyricOtherColor: "#8899aa", lyricFillColor: "#ffb6c1", playerBgMode: "follow" as const, playerBgColor: "", cyberBgmEnabled: true },
  images: { imageWheelMode: "prevNext" as ImageWheelMode },
  widgets: {
    globalWidgets: true,
    widgetPages: {} as Record<string, boolean>,
    myComputer: { enabled: true, position: "bottom-left" as const, myComputerMode: "custom" as const },
    systemMonitor: { enabled: true, position: "bottom-right" as const },
    clock: { enabled: true, position: "top-right" as const },
    calendar: { enabled: true, position: "top-left" as const },
    countdown: { enabled: false, position: "center-right" as const, displayMode: "full" as const, hours: 0, minutes: 5, seconds: 0, loopCount: 1, alertGlow: false, alertVoice: true, voiceInterval: 30 },
  },
};


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
    fontPrimaryColor, fontSecondaryColor, setFontPrimaryColor, setFontSecondaryColor,
    scrollFadeOpacity, setScrollFadeOpacity,
    playerBgColor, playerBgMode, setPlayerBgColor, setPlayerBgMode,
    cyberBgmEnabled, setCyberBgmEnabled,
    cgTextSize, cgTextColor, setCgTextSize, setCgTextColor,
    paletteAccent, paletteSaturation, paletteContrast, paletteCustomized, setPaletteAccent, setPaletteSaturation, setPaletteContrast, resetPaletteToTheme,
  } = useSettingsStore();
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
    }
    setConfirmReset(null);
  }, [setLanguage, i18n, setAutoStart, setStartFullscreen, setAutoHideHeader, setAutoHideFooter,
      setTheme, setBgVideoMode, setFontSize, setFontFamily, setHideTitleBar,
      setPaletteAccent, setPaletteSaturation, setPaletteContrast,
      setPreviewOffset, setLyricFontSize, setLyricUseCustomColor, setLyricCurrentColor, setLyricOtherColor, setLyricFillColor, setImageWheelMode,
      setGlobalWidgets, setPageWidget, setEnabled, setPosition, setMyComputerMode, setCountdown]);

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
        boxShadow: isCG ? "0 0 40px color-mix(in srgb, var(--color-primary) 12%, transparent), 0 0 80px color-mix(in srgb, var(--color-accent) 6%, transparent)" : undefined,
      }}>
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
                <LicenseSection t={t} i18n={i18n} />
                <SecondaryDisplaySection t={t} i18n={i18n} />
                <LanguageSection {...{ t, language, handleLanguage, languages }} />
                <StartupSection {...{ t, autoStart, autoLoading, handleAutoStart, startFullscreen, setStartFullscreen, autoHideHeader, setAutoHideHeader, autoHideFooter, setAutoHideFooter, hideTitleBar, setHideTitleBar }} />
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
                            style={{ background: a.value }} title={a.label} />
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
                  </div>
                </section>

                {/* ── Display ── */}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.look_display")}</h4>
                  <div className="space-y-3">
                    <BgModeSection {...{ t, bgVideoMode, setBgVideoMode }} />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={autoHideHeader} onChange={(e) => setAutoHideHeader(e.target.checked)} className="h-4 w-4 rounded accent-[var(--color-primary)]" />
                      <span className="text-sm text-gray-300">{t("settings.auto_hide_header")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={autoHideFooter} onChange={(e) => setAutoHideFooter(e.target.checked)} className="h-4 w-4 rounded accent-[var(--color-primary)]" />
                      <span className="text-sm text-gray-300">{t("settings.auto_hide_footer")}</span>
                    </label>
                  </div>
                </section>

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
            {activeTab === "movies" && (
              <section><p className="text-sm text-gray-500">{t("settings.placeholder_movies")}</p></section>
            )}

            {/* ═══ Games Tab ═══ */}
            {activeTab === "games" && (
              <section><p className="text-sm text-gray-500">{t("settings.placeholder_games")}</p></section>
            )}

            {/* ═══ Widgets Tab ═══ */}
            {activeTab === "widgets" && (
              <WidgetsSection {...{ t, globalWidgets, setGlobalWidgets, widgetPages, setPageWidget, myComputer, systemMonitor, clock, calendar, countdown, setEnabled, setPosition, setMyComputerMode, setCountdown }}>
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

function ResetButton({ tab, t, onReset }: { tab: string; t: (k: string) => string; onReset: () => void }) {
  return (
    <div className="pt-2 border-t border-white/5">
      <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs text-gray-400">
        <RotateCcw className="h-3 w-3" />{t("settings.reset_tab", { tab: t(`settings.tab_${tab}`) })}
      </Button>
    </div>
  );
}

function SecondaryDisplaySection({ t, i18n }: { t: any; i18n: any }) {
  const isZh = i18n.language?.startsWith("zh");
  const { license } = useLicenseStore();
  const isUltra = license.tier === "ultra" || license.tier === "custom";
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [monitors, setMonitors] = useState<Array<{ name: string; isPrimary: boolean }>>([]);
  const [selectedMonitor, setSelectedMonitor] = useState(0);

  // Check current secondary window state
  useEffect(() => {
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke<any[]>("list_monitors").then(list => {
        setMonitors((list || []).map((m, i) => ({ name: m.name || `显示器 ${i + 1}`, isPrimary: m.isPrimary })));
      }).catch(()=>{});
      invoke<{ open: boolean }>("is_secondary_window_open").then(info => setSecondaryOpen(info?.open ?? false)).catch(()=>{});
    }).catch(()=>{});
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (secondaryOpen) {
        await closeSecondaryDisplay();
        setSecondaryOpen(false);
      } else {
        await openSecondaryDisplay();
        setSecondaryOpen(true);
      }
    } catch(e: any) {
      alert(isZh ? `操作失败: ${e}` : `Failed: ${e}`);
    }
    setLoading(false);
  };

  // Dev mode (.env VITE_LICENSE_TIER) → no restrictions
  if (!isUltra && !(import.meta as any).env?.VITE_LICENSE_TIER) return null;

  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {isZh ? "副屏显示" : "Secondary Display"}
      </h4>
      <div className="p-4 rounded-xl border border-white/5 space-y-4"
        style={{ background: "color-mix(in srgb, var(--color-primary) 4%, transparent)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">{isZh ? "启用副屏" : "Enable Secondary Display"}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{isZh ? "在外接显示器上显示播放信息与视觉面板" : "Show media info on external monitor"}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={secondaryOpen} onChange={handleToggle} disabled={loading}
              className="sr-only peer" />
            <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-primary/60 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
          </label>
        </div>

        {monitors.length > 1 && secondaryOpen && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>{isZh ? "显示器:" : "Monitor:"}</span>
            <select value={selectedMonitor} onChange={e => setSelectedMonitor(Number(e.target.value))}
              className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[11px] outline-none">
              {monitors.map((m, i) => (
                <option key={i} value={i}>{m.name}{m.isPrimary ? (isZh ? "（主屏）" : " (Primary)") : ""}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </section>
  );
}

function LicenseSection({ t, i18n }: { t: any; i18n: any }) {
  const isZh = i18n.language?.startsWith("zh");
  const { license, openActivation, unbind } = useLicenseStore();
  const tier = license.tier;

  const tierLabel = (t: string) => {
    if (t === "free") return isZh ? "社区版" : "Community";
    if (t === "pro") return "Pro";
    if (t === "ultra") return "Ultra";
    if (t === "custom") return isZh ? "定制版" : "Custom";
    return t;
  };

  const durLabel = (d: string) => {
    if (d === "permanent") return isZh ? "永久" : "Permanent";
    if (d === "monthly") return isZh ? "月付" : "Monthly";
    if (d === "yearly") return isZh ? "年付" : "Yearly";
    return d;
  };

  // Countdown: "剩余 15 天" or HH:MM:SS when < 24h
  const expiryDisplay = (exp: string): string => {
    const diff = new Date(exp).getTime() - Date.now();
    if (diff <= 0) return isZh ? "已过期" : "Expired";
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days > 1) return `${isZh ? "剩余" : ""} ${days} ${isZh ? "天" : "d"}`;
    const h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const s = Math.floor((diff % (60 * 1000)) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {isZh ? "许可证" : "License"}
      </h4>
      <div className="flex items-center justify-between p-4 rounded-xl border border-white/5"
        style={{ background: "color-mix(in srgb, var(--color-primary) 4%, transparent)" }}>
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
                  {durLabel(license.duration)}
                </span>
              )}
            </p>
            {tier !== "free" && license.expiresAt && (
              <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                {expiryDisplay(license.expiresAt)}
              </p>
            )}
          </div>
        </div>
        {tier === "free" ? (
          <button
            onClick={openActivation}
            className="px-3 py-1.5 rounded-lg border border-primary/40 text-primary-light text-xs font-medium hover:bg-primary/10 transition-colors"
          >
            {isZh ? "输入激活码" : "Enter Code"}
          </button>
        ) : (
          <button
            onClick={async () => {
              if (!confirm(isZh
                ? "确定要解除此设备的绑定吗？\n激活码将被释放，可在其他设备上使用。"
                : "Unbind this device?\nThe activation code will be released for use on another device."
              )) return;
              try {
                await unbind();
              } catch (e) {
                alert(isZh ? `解绑失败: ${e}` : `Unbind failed: ${e}`);
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 text-xs font-medium hover:bg-white/5 transition-colors"
          >
            {isZh ? "解除绑定" : "Unbind"}
          </button>
        )}
      </div>
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
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
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
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
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
            {lang.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function StartupSection({ t, autoStart, autoLoading, handleAutoStart, startFullscreen, setStartFullscreen, autoHideHeader, setAutoHideHeader, autoHideFooter, setAutoHideFooter, hideTitleBar, setHideTitleBar }: any) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{t("settings.startup")}</h4>
      <div className="space-y-4">
        <ToggleRow label={t("settings.auto_launch")} active={autoStart} disabled={autoLoading} onToggle={handleAutoStart} />
        <ToggleRow label={t("settings.start_fullscreen")} active={startFullscreen} onToggle={() => setStartFullscreen(!startFullscreen)} />
        <ToggleRow label={t("settings.hide_title_bar")} active={hideTitleBar} onToggle={() => setHideTitleBar(!hideTitleBar)} hint={t("settings.hide_title_bar_hint")} />
        <ToggleRow label={t("settings.auto_hide_header")} active={autoHideHeader} onToggle={() => setAutoHideHeader(!autoHideHeader)} icon={<EyeOff className="h-3.5 w-3.5 text-gray-500" />} />
        <ToggleRow label={t("settings.auto_hide_footer")} active={autoHideFooter} onToggle={() => setAutoHideFooter(!autoHideFooter)} icon={<EyeOff className="h-3.5 w-3.5 text-gray-500" />} />
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
            {item.image ? <img src={item.image} alt="" className="w-14 h-14 rounded-full object-cover" /> : <span className="text-xl">{item.emoji}</span>}
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

function WidgetsSection({ t, globalWidgets, setGlobalWidgets, widgetPages, setPageWidget, myComputer, systemMonitor, clock, calendar, countdown, setEnabled, setPosition, setMyComputerMode, setCountdown, children }: any) {
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
          const v = f.value, label = f.label;
          return (
            <button key={v} onClick={() => setFontFamily(v)}
              className={cn("px-3 py-2 rounded-lg text-xs border transition-all duration-200 text-left truncate",
                fontFamily === v ? "bg-primary/15 border-primary/40 text-primary-light font-semibold" : "border-transparent hover:bg-surface-lighter text-gray-400")}>
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
