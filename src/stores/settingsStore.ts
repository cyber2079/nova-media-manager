import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";
import type { ThemeName } from "./themeStore";

export type BgVideoMode = "contain" | "cover" | "fill" | "none";
export type WallpaperMode = "none" | "single" | "folder";
export type WallpaperShuffle = "sequential" | "random";
export type WallpaperFit = "none" | "cover" | "fill" | "contain";
export type WallpaperConfig = {
  mode: WallpaperMode;
  path: string;
  shuffle: WallpaperShuffle;
  interval: number; // seconds
  fit: WallpaperFit;
};

export type BgVideoLoopConfig = {
  enabled: boolean;
  loopCount: number;
  firstPlayStart: number;
  firstPlayEnd: number;
  loopStart: number;
  loopDuration: number;
  transitionMs: number;
  playbackRate: number;
};

export type FontSize = "small" | "normal" | "large";
export type IconSize = "normal" | "medium" | "large";
export type VisualizerMode = "bars" | "dots" | "blocks";

export function fontSizeScale(v: FontSize): number {
  if (v === "small") return 0.85;
  if (v === "large") return 1.15;
  return 1;
}

export function iconSizeScale(v: IconSize): number {
  if (v === "medium") return 1.3;
  if (v === "large") return 1.6;
  return 1;
}

export type ImageWheelMode = "prevNext" | "zoom";
export type SystemDialogStyle = "windows" | "theme";

/** Font entry shared shape */
export interface FontEntry { value: string; label: string; i18nKey: string; css: string; google?: string }

/** Combined fonts — cover both CJK + Latin in one preset (choose one or none) */
export const COMBINED_FONT_LIST: FontEntry[] = [
  { value: "lxgw", label: "霞鹜文楷", i18nKey: "fonts.lxgw_wenkai", css: '"LXGW WenKai", "楷体", "KaiTi", serif', google: "LXGW+WenKai:wght@400;700" },
  { value: "maoken-defectica", label: "赛博朋克", i18nKey: "fonts.cyberpunk", css: '"Defectica", "Maoken Glitch Sans", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { value: "defectica", label: "英文破碎", i18nKey: "fonts.english_broken", css: '"Defectica", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { value: "audiowide-mono", label: "蓝图等宽", i18nKey: "fonts.blueprint_mono", css: '"Audiowide Mono", "JetBrains Mono", "Fira Code", monospace' },
];

/** CJK-only fonts — choose one (or "" for system default) */
export const CJK_FONT_LIST: FontEntry[] = [
  { value: "", label: "系统默认", i18nKey: "fonts.system_default", css: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { value: "noto-sans-sc", label: "思源黑体", i18nKey: "fonts.source_han_sans", css: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', google: "Noto+Sans+SC:wght@400;500;600;700" },
  { value: "noto-serif-sc", label: "思源宋体", i18nKey: "fonts.source_han_serif", css: '"Noto Serif SC", "STSong", "SimSun", serif', google: "Noto+Serif+SC:wght@400;600;700" },
  { value: "source-han-sans", label: "Source Han Sans", i18nKey: "fonts.source_hansans", css: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
  { value: "maoken-glitch", label: "中文故障", i18nKey: "fonts.chinese_glitch", css: '"Maoken Glitch Sans", "PingFang SC", "Microsoft YaHei", sans-serif' },
];

/** Latin-only fonts — choose one (or "" for system default) */
export const EN_FONT_LIST: FontEntry[] = [
  { value: "", label: "System Default", i18nKey: "fonts.system_default", css: "system-ui, sans-serif" },
  { value: "inter", label: "Inter", i18nKey: "fonts.inter", css: '"Inter", system-ui, sans-serif' },
  { value: "jetbrains-mono", label: "JetBrains Mono", i18nKey: "fonts.jetbrains_mono", css: '"JetBrains Mono", "Fira Code", monospace', google: "JetBrains+Mono:wght@400;500;600;700" },
  { value: "playfair", label: "Playfair Display", i18nKey: "fonts.playfair", css: '"Playfair Display", "Times New Roman", serif', google: "Playfair+Display:wght@400;600;700" },
  { value: "dm-sans", label: "DM Sans", i18nKey: "fonts.dm_sans", css: '"DM Sans", system-ui, sans-serif', google: "DM+Sans:wght@400;500;600;700" },
  { value: "space-grotesk", label: "Space Grotesk", i18nKey: "fonts.space_grotesk", css: '"Space Grotesk", system-ui, sans-serif', google: "Space+Grotesk:wght@400;500;600;700" },
];

/** Legacy flat list — kept for backward compat (SettingsDialog scrollFade still references it) */
export const FONT_LIST = [...COMBINED_FONT_LIST, ...CJK_FONT_LIST.filter(f => f.value !== ""), ...EN_FONT_LIST.filter(f => f.value !== "")];

// ═══════════════ PER-THEME PALETTE DEFAULTS ═══════════════
// Each theme pairs with a default accent color, saturation level, and dark/light.
// Switching themes auto-applies these; users can then tweak with the Palette controls.

export interface PaletteConfig {
  accent: string;     // hex color
  saturation: number; // 0-100
}

export const ACCENT_OPTIONS = [
  { value: "#4788f0", label: "藏蓝", i18nKey: "colors.navy" },
  { value: "#c0394a", label: "酒红", i18nKey: "colors.wine" },
  { value: "#c2861c", label: "深棕", i18nKey: "colors.brown" },
  { value: "#7c6ff0", label: "暗紫", i18nKey: "colors.dark_purple" },
  { value: "#06b6d4", label: "青绿", i18nKey: "colors.teal" },
  { value: "#f59e0b", label: "琥珀", i18nKey: "colors.amber" },
  { value: "#ec4899", label: "玫红", i18nKey: "colors.rose" },
  { value: "#6366f1", label: "靛蓝", i18nKey: "colors.indigo" },
  { value: "#ef4444", label: "绯红", i18nKey: "colors.crimson" },
  { value: "#f97316", label: "橙色", i18nKey: "colors.orange" },
  { value: "#84cc16", label: "草绿", i18nKey: "colors.lime" },
  { value: "#10b981", label: "翠绿", i18nKey: "colors.emerald" },
  { value: "#0ea5e9", label: "天蓝", i18nKey: "colors.sky" },
  { value: "#a855f7", label: "紫罗兰", i18nKey: "colors.violet" },
  { value: "#d946ef", label: "品红", i18nKey: "colors.fuchsia" },
  { value: "#64748b", label: "岩灰", i18nKey: "colors.slate" },
  { value: "#171717", label: "纯黑", i18nKey: "colors.black" },
  { value: "#f5f5f5", label: "纯白", i18nKey: "colors.white" },
];

export const THEME_PALETTE_DEFAULTS: Record<string, PaletteConfig> = {
  default: { accent: "#4788f0", saturation: 50 },
};

// ── Per-theme effects (scanline, etc.) ──
export interface ScanlineConfig {
  enabled: boolean;
  color: string;
  opacity: number;     // 0–100 (CSS: /100)
  thickness: number;   // px
}

export interface PerThemeFx {
  scanline?: ScanlineConfig;
}

export const DEFAULT_SCANLINE: ScanlineConfig = {
  enabled: true,
  color: "#000000",
  opacity: 3,
  thickness: 2,
};

export type SettingsState = {
  language: string;
  autoStart: boolean;
  startFullscreen: boolean;
  autoHideHeader: boolean;
  autoHideFooter: boolean;
  customColor: string;
  useCustomColor: boolean;
  bgVideoMode: BgVideoMode;
  bgVideoLoop: BgVideoLoopConfig;
  videoPaused: boolean;
  lastVolume: number;
  previewOffset: number;
  lyricFontSize: "normal" | "large" | "off";
  lyricUseCustomColor: boolean;
  lyricCurrentColor: string;
  lyricOtherColor: string;
  lyricFillColor: string;
  fontSize: FontSize;
  iconSize: IconSize;
  fontFamily: string;
  fontFamilyCJK: string;
  fontFamilyEN: string;
  systemDialogStyle: SystemDialogStyle;
  visualizerMode: VisualizerMode;
  imageWheelMode: ImageWheelMode;
  barOpacity: number;
  barBlur: number;
  glassMasterEnabled: boolean;
  globalGlassOpacity: number;
  globalGlassBlur: number;
  mainOpacity: number;
  mainBlur: number;
  dialogOpacity: number;
  dialogBlur: number;
  surfaceSaturation: number;
  surfaceOpacity: number;
  bgOverlayOpacity: number;
  fontPrimaryColor: string;
  fontSecondaryColor: string;
  widgetTextColor: string;
  scrollFadeOpacity: number;
  playerBgColor: string;
  playerBgMode: "follow" | "custom";
  cyberBgmEnabled: boolean;
  cgTextSize: "xs" | "sm" | "base";
  cgTextColor: string;
  cgTextBgColor: string;
  cgTextBgOpacity: number;

  // ── Wallpaper (default theme only) ──
  wallpaper: WallpaperConfig;

  // ── 外接播放器 ──
  externalPlayer: ExternalPlayerConfig;

  // ── New palette system (replaces 13 individual controls) ──
  paletteAccent: string;
  paletteSaturation: number;  // 0-100
  /** Whether user has manually adjusted palette from theme default */
  paletteCustomized: boolean;
  /** Random neon color per element (IconsNeon Todos mode) */
  paletteRandomSeed: number;
  paletteRandomEnabled: boolean;

  dashboardMode: "full" | "strip";
  contentMinimized: Record<string, boolean>;

  // Init from persistent store
  init: () => Promise<void>;
  setDashboardMode: (m: "full" | "strip") => void;
  toggleContentMinimized: (page: string) => void;
  setLanguage: (lang: string) => void;
  setAutoStart: (on: boolean) => Promise<void>;
  setStartFullscreen: (on: boolean) => void;
  setAutoHideHeader: (on: boolean) => void;
  setAutoHideFooter: (on: boolean) => void;
  setCustomColor: (color: string) => void;
  setUseCustomColor: (on: boolean) => void;
  setBgVideoMode: (mode: BgVideoMode) => void;
  setBgVideoLoop: (cfg: Partial<BgVideoLoopConfig>) => void;
  setVideoPaused: (paused: boolean) => void;
  setLastVolume: (v: number) => void;
  setPreviewOffset: (v: number) => void;
  setLyricFontSize: (v: "normal" | "large" | "off") => void;
  setLyricUseCustomColor: (v: boolean) => void;
  setLyricCurrentColor: (v: string) => void;
  setLyricOtherColor: (v: string) => void;
  setLyricFillColor: (v: string) => void;
  setFontSize: (v: FontSize) => void;
  setIconSize: (v: IconSize) => void;
  setVisualizerMode: (v: VisualizerMode) => void;
  setImageWheelMode: (v: ImageWheelMode) => void;
  setBarOpacity: (v: number) => void;
  setBarBlur: (v: number) => void;
  setGlassMasterEnabled: (v: boolean) => void;
  setGlobalGlassOpacity: (v: number) => void;
  setGlobalGlassBlur: (v: number) => void;
  setMainOpacity: (v: number) => void;
  setMainBlur: (v: number) => void;
  setDialogOpacity: (v: number) => void;
  setDialogBlur: (v: number) => void;
  setSurfaceSaturation: (v: number) => void;
  setSurfaceOpacity: (v: number) => void;
  setBgOverlayOpacity: (v: number) => void;
  setFontPrimaryColor: (v: string) => void;
  setFontSecondaryColor: (v: string) => void;
  setWidgetTextColor: (v: string) => void;
  setScrollFadeOpacity: (v: number) => void;
  setPlayerBgColor: (v: string) => void;
  setPlayerBgMode: (v: "follow" | "custom") => void;
  setCyberBgmEnabled: (v: boolean) => void;
  setCgTextSize: (v: "xs" | "sm" | "base") => void;
  setCgTextColor: (v: string) => void;
  setCgTextBgColor: (v: string) => void;
  setCgTextBgOpacity: (v: number) => void;
  setFontFamily: (v: string) => void;
  setFontFamilyCJK: (v: string) => void;
  setFontFamilyEN: (v: string) => void;
  setSystemDialogStyle: (v: SystemDialogStyle) => void;
  setPaletteAccent: (v: string) => void;
  setPaletteSaturation: (v: number) => void;
  setPaletteRandomSeed: (seed: number) => void;
  setPaletteRandomEnabled: (on: boolean) => void;
  setWallpaperConfig: (cfg: Partial<WallpaperConfig>) => void;
  setExternalPlayer: (cfg: Partial<ExternalPlayerConfig>) => void;
  resetPaletteToTheme: (theme: ThemeName) => void;
  hardwareAcceleration: boolean;
  setHardwareAcceleration: (v: boolean) => void;

  // ── 每主题特效配置 ──
  themeEffects: Record<string, PerThemeFx>;
  setThemeEffects: (themeId: string, fx: PerThemeFx) => void;
  resetThemeEffects: (themeId: string) => void;

  // ── 性能调优 ──
  perfPriority: "normal" | "above_normal" | "high";
  perfIdleReduce: boolean;    // 空闲时降载
  perfReduceAnimations: boolean; // 减弱动效
  cacheCleanupDays: number;   // 缓存清理间隔（天），默认 30
  cacheCleanupLastRun: string | null; // 上次自动清理时间 ISO

  setPerfPriority: (v: "normal" | "above_normal" | "high") => void;
  setPerfIdleReduce: (v: boolean) => void;
  setPerfReduceAnimations: (v: boolean) => void;
  setCacheCleanupDays: (v: number) => void;
  setCacheCleanupLastRun: (v: string) => void;
  applyPerfSettings: () => Promise<void>;
};

const STORAGE_KEY = "app-settings";

function getDefaultLoop(): BgVideoLoopConfig {
  return {
    enabled: true, loopCount: 0, firstPlayStart: 0, firstPlayEnd: 0,
    loopStart: 0, loopDuration: 3, transitionMs: 450, playbackRate: 0.7};
}

function getDefaultWallpaper(): WallpaperConfig {
  return { mode: "none", path: "", shuffle: "sequential", interval: 30, fit: "none" };
}

function readSaved(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// localStorage written synchronously (survives app close); kv.set debounced 300ms.
// Reads fresh state from store inside the timeout — immune to stale closures.
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  const s = useSettingsStore.getState();
  const payload = JSON.stringify({
    language: s.language, autoStart: s.autoStart, startFullscreen: s.startFullscreen,
    autoHideHeader: s.autoHideHeader, autoHideFooter: s.autoHideFooter,
    customColor: s.customColor, useCustomColor: s.useCustomColor,
    bgVideoMode: s.bgVideoMode, bgVideoLoop: s.bgVideoLoop, videoPaused: s.videoPaused,
    lastVolume: s.lastVolume, previewOffset: s.previewOffset,
    lyricFontSize: s.lyricFontSize, lyricUseCustomColor: s.lyricUseCustomColor,
    lyricCurrentColor: s.lyricCurrentColor, lyricOtherColor: s.lyricOtherColor, lyricFillColor: s.lyricFillColor,
    fontSize: s.fontSize, iconSize: s.iconSize, fontFamily: s.fontFamily, fontFamilyCJK: s.fontFamilyCJK, fontFamilyEN: s.fontFamilyEN, systemDialogStyle: s.systemDialogStyle,
    visualizerMode: s.visualizerMode, imageWheelMode: s.imageWheelMode,
    barOpacity: s.barOpacity,
    barBlur: s.barBlur,
    glassMasterEnabled: s.glassMasterEnabled, globalGlassOpacity: s.globalGlassOpacity, globalGlassBlur: s.globalGlassBlur,
    mainOpacity: s.mainOpacity, mainBlur: s.mainBlur, dialogOpacity: s.dialogOpacity, dialogBlur: s.dialogBlur,
    surfaceSaturation: s.surfaceSaturation, surfaceOpacity: s.surfaceOpacity, bgOverlayOpacity: s.bgOverlayOpacity,
    fontPrimaryColor: s.fontPrimaryColor, fontSecondaryColor: s.fontSecondaryColor, widgetTextColor: s.widgetTextColor, scrollFadeOpacity: s.scrollFadeOpacity, playerBgColor: s.playerBgColor, playerBgMode: s.playerBgMode, cyberBgmEnabled: s.cyberBgmEnabled, cgTextSize: s.cgTextSize, cgTextColor: s.cgTextColor, cgTextBgColor: s.cgTextBgColor, cgTextBgOpacity: s.cgTextBgOpacity, paletteAccent: s.paletteAccent, paletteSaturation: s.paletteSaturation, paletteCustomized: s.paletteCustomized, paletteRandomSeed: s.paletteRandomSeed, paletteRandomEnabled: s.paletteRandomEnabled, hardwareAcceleration: s.hardwareAcceleration, wallpaper: s.wallpaper, externalPlayer: s.externalPlayer,
    perfPriority: s.perfPriority, perfIdleReduce: s.perfIdleReduce, perfReduceAnimations: s.perfReduceAnimations, cacheCleanupDays: s.cacheCleanupDays, cacheCleanupLastRun: s.cacheCleanupLastRun,
    dashboardMode: s.dashboardMode, contentMinimized: s.contentMinimized,
    themeEffects: s.themeEffects,
  });
  localStorage.setItem(STORAGE_KEY, payload);
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    kv.set(STORAGE_KEY, payload).catch(() => {});
  }, 300);
}

// persist() — write localStorage synchronously, defer kv.set via debounce.
function persist() { schedulePersist(); }

/** Derive all --color- CSS vars from the 3-knob palette system.
 *
 *  Saturation (0-100) directly controls the HSL saturation of --color-primary:
 *    0   → nearly grayscale (HSL S ≈ 5%)
 *    50  → base accent color unchanged
 *    100 → fully saturated (HSL S = 100%)
 *
 *  Because nearly every UI element references --color-primary via
 *  var() / color-mix() / Tailwind, the change is immediately visible
 *  without any CSS filter or stacking-context side-effects. */
export function applyPalette() {
  const s = useSettingsStore.getState();
  const v = s.paletteSaturation; // 0-100
  const accent = s.paletteAccent;
  const root = document.documentElement;

  const isDark = true;
  const text = isDark ? "#edeff4" : "#1c1c1e";
  const muted = isDark ? "#8a99b8" : "#5c5b66";

  // ── HSL-saturate the accent colour ──
  const [h, baseS, l] = hexToHSL(accent);
  const sFactor = v / 50;                         // 0 → 2×
  const newS = Math.min(100, Math.max(5, baseS * sFactor));
  const primary = hslToHex(h, newS, l);
  const primaryLight = hslToHex(h, newS, Math.min(94, l + 20));
  const primaryDark = hslToHex(h, Math.min(100, newS * 1.05), Math.max(6, l - 18));

  // Use !important to beat any residual --nv-* vars left by the token engine
  root.style.setProperty("--color-primary", primary, "important");
  root.style.setProperty("--color-primary-light", primaryLight, "important");
  root.style.setProperty("--color-primary-dark", primaryDark, "important");

  // Wipe ALL --nv-* inline styles the token engine may have left
  const css = root.style.cssText;
  root.style.cssText = css.split(";").filter(s => !s.trim().startsWith("--nv-")).join(";");

  // ── Typography ──
  root.style.setProperty("--font-primary", text);
  root.style.setProperty("--font-secondary", muted);
  root.style.setProperty("--scroll-fade-opacity", String(v / 400));

  // ── CG text colors follow accent ──
  root.style.setProperty("--cg-text-color", primary);
  root.style.setProperty("--cg-text-bg", primary);

  root.removeAttribute("data-palette");
}

/** Apply font primary/secondary colors as CSS custom properties */
export function applyFontColors() {
  const { fontPrimaryColor: pc, fontSecondaryColor: sc, widgetTextColor: wc } = useSettingsStore.getState();
  const root = document.documentElement;
  root.style.setProperty('--font-primary', pc);
  root.style.setProperty('--font-secondary', sc);
  root.style.setProperty('--font-widget', wc);
}

/** Apply lyric custom colors (or reset to defaults when off) */
export function applyScrollFade() {
  const root = document.documentElement;
  root.style.setProperty('--scroll-fade-opacity', String(useSettingsStore.getState().scrollFadeOpacity / 100));
}

export function applyLyricColors() {
  const s = useSettingsStore.getState();
  const root = document.documentElement;
  if (s.lyricUseCustomColor) {
    root.style.setProperty('--lyric-current', s.lyricCurrentColor);
    root.style.setProperty('--lyric-other', s.lyricOtherColor);
    root.style.setProperty('--lyric-fill', s.lyricFillColor);
  } else {
    root.style.removeProperty('--lyric-current');
    root.style.removeProperty('--lyric-other');
    root.style.removeProperty('--lyric-fill');
  }
}

/** Apply global font family + load Google Fonts if needed.
 *
 *  Two modes (mutually exclusive):
 *    Combined — fontFamily picks from COMBINED_FONT_LIST (covers CJK+Latin as one preset).
 *    Split   — fontFamilyCJK / fontFamilyEN pick independently; empty = system default.
 *
 *  CSS stack order: Latin → CJK → generic fallback (browser prioritises Latin glyphs first). */
export function applyFontFamily() {
  const { fontFamily, fontFamilyCJK, fontFamilyEN } = useSettingsStore.getState();

  let css: string;
  let googleFonts: string[] = [];

  if (fontFamily) {
    // ── Combined mode ──
    const entry = COMBINED_FONT_LIST.find(f => f.value === fontFamily)
               ?? FONT_LIST.find(f => f.value === fontFamily);
    css = entry?.css || "system-ui, sans-serif";
    if (entry?.google) googleFonts.push(entry.google);
  } else {
    // ── Split mode ──
    // CSS stack: EN-specific fonts → CJK fonts → system-ui → sans-serif
    // system-ui on Chinese Windows resolves to CJK-capable fonts (Microsoft YaHei etc.),
    // so CJK must come BEFORE system-ui, ELSE the browser renders Chinese glyphs from
    // system-ui and never reaches the user's chosen CJK font.
    const enEntry = EN_FONT_LIST.find(f => f.value === fontFamilyEN);
    const cjkEntry = CJK_FONT_LIST.find(f => f.value === fontFamilyCJK);
    const latin = enEntry?.css || "system-ui, sans-serif";
    const cjk = cjkEntry?.css || "";
    if (cjk) {
      // Extract only the specific English fonts, strip system-ui / generic from EN stack
      const enOnly = latin.split(", ").filter(f =>
        !["system-ui", "sans-serif", "serif", "monospace"].includes(f)
      ).join(", ");
      css = [enOnly || "system-ui", cjk, "sans-serif"].filter(Boolean).join(", ");
    } else {
      css = latin;
    }
    if (enEntry?.google) googleFonts.push(enEntry.google);
    if (cjkEntry?.google) googleFonts.push(cjkEntry.google);
  }

  document.body.style.fontFamily = css;

  // ── Google Fonts dynamic <link> ──
  const id = "google-font-dynamic";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (googleFonts.length > 0) {
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${googleFonts.map(g => `family=${g}`).join("&")}&display=swap`;
  } else if (link) {
    link.remove();
  }
}

// ── 外接播放器配置 ──
export type ExternalPlayerMode = "auto" | "always" | "never";
export interface ExternalPlayerConfig {
  mode: ExternalPlayerMode; // auto=按格式分流 always=全部外接 never=全部内置
  kind: string;             // potplayer | vlc | mpv | mpc-hc | custom
  path: string;             // 播放器 exe 路径
}
export const defaultExternalPlayer = (): ExternalPlayerConfig => ({ mode: "auto", kind: "", path: "" });
/** WebView2 基本放不了的格式 — auto 模式下走外接播放器 */
export const EXTERNAL_PLAYER_EXTS = ["mkv", "avi", "flv", "wmv", "ts", "m2ts", "rmvb", "iso"];


// Re-export from shared color utilities module
export { hexToHSL, hslToHex, computeThemeColors, COLOR_PRESETS } from "@/lib/colorUtils";
import { hexToHSL, hslToHex } from "@/lib/colorUtils";

export const useSettingsStore = create<SettingsState>((set, get) => {
  const saved = readSaved();

  return {
    language: saved.language || "zh",
    autoStart: saved.autoStart ?? true,
    startFullscreen: saved.startFullscreen !== false,
    autoHideHeader: saved.autoHideHeader || false,
    autoHideFooter: saved.autoHideFooter || false,
    customColor: saved.customColor || "#4488ff",
    useCustomColor: saved.useCustomColor || false,
    bgVideoMode: (() => {
      const raw = (saved as any).bgVideoMode;
      if (raw === "normal") return "contain";
      if (raw === "cover" || raw === "fill" || raw === "none") return raw;
      if (raw === "stretch") return "fill";
      return "cover";
    })(),
    bgVideoLoop: (saved as any).bgVideoLoop || getDefaultLoop(),
    videoPaused: saved.videoPaused ?? false,
    lastVolume: (saved as any).lastVolume ?? 0.8,
    previewOffset: (saved as any).previewOffset ?? 0.5,
    lyricFontSize: (saved as any).lyricFontSize || "normal",
    lyricUseCustomColor: (saved as any).lyricUseCustomColor || false,
    lyricCurrentColor: (saved as any).lyricCurrentColor || "#ffffff",
    lyricOtherColor: (saved as any).lyricOtherColor || "#8899aa",
    lyricFillColor: (saved as any).lyricFillColor || "#ffb6c1",
    fontSize: (saved as any).fontSize || "normal",
    iconSize: (saved as any).iconSize || "normal",
    fontFamily: (saved as any).fontFamily || "",
    fontFamilyCJK: (saved as any).fontFamilyCJK || "",
    fontFamilyEN: (saved as any).fontFamilyEN || "",
    systemDialogStyle: (saved as any).systemDialogStyle || "windows",
    visualizerMode: (saved as any).visualizerMode || "bars",
    imageWheelMode: (saved as any).imageWheelMode || "prevNext",
    barOpacity: (saved as any).barOpacity ?? (saved as any).footerOpacity ?? 92,
    barBlur: (saved as any).barBlur ?? 16,
    glassMasterEnabled: (saved as any).glassMasterEnabled ?? (
      // Backward compat: if user previously customized bar opacity/blur away from defaults, disable master so their settings stay active.
      // Check saved values (not current state) to detect prior customization.
      ((saved as any).barOpacity != null && (saved as any).barOpacity !== 92) || ((saved as any).barBlur != null && (saved as any).barBlur !== 16) ? false : true
    ),
    globalGlassOpacity: (saved as any).globalGlassOpacity ?? 70,
    globalGlassBlur: (saved as any).globalGlassBlur ?? 3,
    mainOpacity: (saved as any).mainOpacity ?? 92,
    mainBlur: (saved as any).mainBlur ?? 16,
    dialogOpacity: (saved as any).dialogOpacity ?? 92,
    dialogBlur: (saved as any).dialogBlur ?? 16,
    surfaceSaturation: (saved as any).surfaceSaturation ?? 4,
    surfaceOpacity: (saved as any).surfaceOpacity ?? 92,
    bgOverlayOpacity: (saved as any).bgOverlayOpacity ?? 70,
    fontPrimaryColor: (saved as any).fontPrimaryColor || "#ffffff",
    fontSecondaryColor: (saved as any).fontSecondaryColor || "#9ab8d4",
    widgetTextColor: (saved as any).widgetTextColor || "#e8f4ff",
    scrollFadeOpacity: (saved as any).scrollFadeOpacity ?? 30,
    playerBgColor: (saved as any).playerBgColor || "",
    playerBgMode: (saved as any).playerBgMode || "follow",
    cyberBgmEnabled: (saved as any).cyberBgmEnabled ?? true,
    cgTextSize: (saved as any).cgTextSize || "xs",
    cgTextColor: (saved as any).cgTextColor || "#e0c0ff",
    cgTextBgColor: (saved as any).cgTextBgColor || "#c74dff",
    cgTextBgOpacity: (saved as any).cgTextBgOpacity ?? 15,
    wallpaper: (saved as any).wallpaper || getDefaultWallpaper(),
    externalPlayer: (saved as any).externalPlayer || defaultExternalPlayer(),
    paletteAccent: (saved as any).paletteAccent || "#4788f0",
    paletteSaturation: (saved as any).paletteSaturation ?? ((saved as any).paletteVibrancy != null ? (saved as any).paletteVibrancy * 10 : 50),
    paletteCustomized: (saved as any).paletteCustomized || false,
    paletteRandomSeed: (saved as any).paletteRandomSeed ?? 0,
    paletteRandomEnabled: (saved as any).paletteRandomEnabled || false,
    hardwareAcceleration: (saved as any).hardwareAcceleration ?? true,
    perfPriority: (saved as any).perfPriority || "normal",
    perfIdleReduce: (saved as any).perfIdleReduce ?? true,
    perfReduceAnimations: (saved as any).perfReduceAnimations || false,
    cacheCleanupDays: (saved as any).cacheCleanupDays || 30,
    cacheCleanupLastRun: (saved as any).cacheCleanupLastRun || null,
    dashboardMode: (saved as any).dashboardMode || "full",
    contentMinimized: (saved as any).contentMinimized || {},
    themeEffects: (saved as any).themeEffects || {},

    init: async () => {
      const raw = await kv.get(STORAGE_KEY);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          set({
            language: s.language ?? get().language,
            autoStart: s.autoStart ?? get().autoStart,
            startFullscreen: s.startFullscreen ?? get().startFullscreen,
            autoHideHeader: s.autoHideHeader ?? get().autoHideHeader,
            autoHideFooter: s.autoHideFooter ?? get().autoHideFooter,
            customColor: s.customColor ?? get().customColor,
            useCustomColor: s.useCustomColor ?? get().useCustomColor,
            bgVideoMode: (() => {
              const raw = s.bgVideoMode as string | undefined;
              if (raw === "normal") return "contain" as BgVideoMode;
              if (raw === "stretch") return "fill" as BgVideoMode;
              return (raw as BgVideoMode | undefined) ?? get().bgVideoMode;
            })(),
            bgVideoLoop: s.bgVideoLoop ?? get().bgVideoLoop,
            videoPaused: s.videoPaused ?? get().videoPaused,
            lastVolume: s.lastVolume ?? get().lastVolume,
            previewOffset: s.previewOffset ?? get().previewOffset,
            lyricFontSize: s.lyricFontSize ?? get().lyricFontSize,
            lyricUseCustomColor: (s.lyricUseCustomColor as boolean) ?? get().lyricUseCustomColor,
            lyricCurrentColor: (s.lyricCurrentColor as string) ?? get().lyricCurrentColor,
            lyricOtherColor: (s.lyricOtherColor as string) ?? get().lyricOtherColor,
            lyricFillColor: (s.lyricFillColor as string) ?? get().lyricFillColor,
            fontSize: s.fontSize ?? get().fontSize,
            iconSize: s.iconSize ?? get().iconSize,
            fontFamily: (s.fontFamily as string) ?? get().fontFamily,
            fontFamilyCJK: (s.fontFamilyCJK as string) ?? get().fontFamilyCJK,
            fontFamilyEN: (s.fontFamilyEN as string) ?? get().fontFamilyEN,
            systemDialogStyle: (s.systemDialogStyle as SystemDialogStyle) ?? get().systemDialogStyle,
            visualizerMode: (s.visualizerMode as any) ?? get().visualizerMode,
            imageWheelMode: (s.imageWheelMode as any) ?? get().imageWheelMode,
            barOpacity: (s.barOpacity as number) ?? (s as any).footerOpacity ?? get().barOpacity,
            barBlur: (s.barBlur as number) ?? get().barBlur,
            glassMasterEnabled: (s.glassMasterEnabled as boolean) ?? get().glassMasterEnabled,
            globalGlassOpacity: (s.globalGlassOpacity as number) ?? get().globalGlassOpacity,
            globalGlassBlur: (s.globalGlassBlur as number) ?? get().globalGlassBlur,
            mainOpacity: (s.mainOpacity as number) ?? get().mainOpacity,
            mainBlur: (s.mainBlur as number) ?? get().mainBlur,
            dialogOpacity: (s.dialogOpacity as number) ?? get().dialogOpacity,
            dialogBlur: (s.dialogBlur as number) ?? get().dialogBlur,
            surfaceSaturation: (s.surfaceSaturation as number) ?? get().surfaceSaturation,
            surfaceOpacity: (s.surfaceOpacity as number) ?? get().surfaceOpacity,
            fontPrimaryColor: (s.fontPrimaryColor as string) ?? get().fontPrimaryColor,
            fontSecondaryColor: (s.fontSecondaryColor as string) ?? get().fontSecondaryColor,
            widgetTextColor: (s.widgetTextColor as string) ?? get().widgetTextColor,
            scrollFadeOpacity: (s.scrollFadeOpacity as number) ?? get().scrollFadeOpacity,
            playerBgColor: (s.playerBgColor as string) ?? get().playerBgColor,
            playerBgMode: (s.playerBgMode as any) ?? get().playerBgMode,
            cyberBgmEnabled: (s.cyberBgmEnabled as boolean) ?? get().cyberBgmEnabled,
            cgTextSize: (s.cgTextSize as any) ?? get().cgTextSize,
            cgTextColor: (s.cgTextColor as string) ?? get().cgTextColor,
            cgTextBgColor: (s.cgTextBgColor as string) ?? get().cgTextBgColor,
            cgTextBgOpacity: (s.cgTextBgOpacity as number) ?? get().cgTextBgOpacity,
            paletteAccent: (s.paletteAccent as string) ?? get().paletteAccent,
            paletteSaturation: (s.paletteSaturation as number) ?? ((s as any).paletteVibrancy != null ? (s as any).paletteVibrancy * 10 : get().paletteSaturation),
            paletteCustomized: (s.paletteCustomized as boolean) ?? get().paletteCustomized, paletteRandomSeed: (s.paletteRandomSeed as number) ?? get().paletteRandomSeed, paletteRandomEnabled: (s.paletteRandomEnabled as boolean) ?? get().paletteRandomEnabled, hardwareAcceleration: (s.hardwareAcceleration as boolean) ?? get().hardwareAcceleration, wallpaper: s.wallpaper ?? get().wallpaper,
            externalPlayer: s.externalPlayer ?? get().externalPlayer,
            dashboardMode: (s.dashboardMode as any) ?? get().dashboardMode,
            contentMinimized: (s.contentMinimized as any) ?? get().contentMinimized,
            themeEffects: (s.themeEffects as any) ?? get().themeEffects});
          applyPalette();
          applyFontColors();
          applyLyricColors();
          applyScrollFade(); applyFontFamily();
        } catch {}
      } else { applyPalette(); applyFontColors(); applyLyricColors(); applyScrollFade(); applyFontFamily(); }
    },

    setLanguage(lang) { set({ language: lang }); persist(); },
    async setAutoStart(on) {
      try { const { enable, disable } = await import("@tauri-apps/plugin-autostart"); if (on) await enable(); else await disable(); } catch {}
      set({ autoStart: on }); persist();
    },
    setStartFullscreen(on) { set({ startFullscreen: on }); persist(); },
    setDashboardMode(m) { set({ dashboardMode: m }); persist(); },
    setHardwareAcceleration(v) { set({ hardwareAcceleration: v }); persist(); },
    setPerfPriority(v) { set({ perfPriority: v }); persist(); },
    setPerfIdleReduce(v) { set({ perfIdleReduce: v }); persist(); },
    setPerfReduceAnimations(v) { set({ perfReduceAnimations: v }); persist(); },
    setCacheCleanupDays(v) { set({ cacheCleanupDays: v }); persist(); },
    setCacheCleanupLastRun(v) { set({ cacheCleanupLastRun: v }); persist(); },
    async applyPerfSettings() {
      const { perfPriority } = get();
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("set_process_priority", { level: perfPriority });
      } catch {}
    },
    toggleContentMinimized(page) { set((s) => ({ contentMinimized: { ...s.contentMinimized, [page]: !s.contentMinimized[page] } })); persist(); },
    setAutoHideHeader(on) { set({ autoHideHeader: on }); persist(); },
    setAutoHideFooter(on) { set({ autoHideFooter: on }); persist(); },
    setCustomColor(color) { set({ customColor: color }); persist(); },
    setUseCustomColor(on) { set({ useCustomColor: on }); persist(); },
    setBgVideoMode(mode) { set({ bgVideoMode: mode }); persist(); },
    setBgVideoLoop(cfg) { set((s) => ({ bgVideoLoop: { ...s.bgVideoLoop, ...cfg } })); persist(); },
    setVideoPaused(paused: boolean) { set({ videoPaused: paused }); persist(); },
    setLastVolume(v) { set({ lastVolume: v }); persist(); },
    setPreviewOffset(v) { set({ previewOffset: v }); persist(); },
    setLyricFontSize(v) { set({ lyricFontSize: v }); persist(); },
    setLyricUseCustomColor(v) { set({ lyricUseCustomColor: v }); persist(); applyLyricColors(); },
    setLyricCurrentColor(v) { set({ lyricCurrentColor: v }); persist(); applyLyricColors(); },
    setLyricOtherColor(v) { set({ lyricOtherColor: v }); persist(); applyLyricColors(); },
    setLyricFillColor(v) { set({ lyricFillColor: v }); persist(); applyLyricColors(); },
    setFontSize(v) { set({ fontSize: v }); persist(); },
    setIconSize(v) { set({ iconSize: v }); persist(); },
    setVisualizerMode(v) { set({ visualizerMode: v }); persist(); },
    setImageWheelMode(v) { set({ imageWheelMode: v }); persist(); },
    setBarOpacity(v) { set({ barOpacity: v }); persist(); },
    setBarBlur(v) { set({ barBlur: v }); persist(); },
    setGlassMasterEnabled(v) { set({ glassMasterEnabled: v }); persist(); },
    setGlobalGlassOpacity(v) { set({ globalGlassOpacity: v }); persist(); },
    setGlobalGlassBlur(v) { set({ globalGlassBlur: v }); persist(); },
    setMainOpacity(v) { set({ mainOpacity: v }); persist(); },
    setMainBlur(v) { set({ mainBlur: v }); persist(); },
    setDialogOpacity(v) { set({ dialogOpacity: v }); persist(); },
    setDialogBlur(v) { set({ dialogBlur: v }); persist(); },
    setSurfaceSaturation(v) { set({ surfaceSaturation: v }); persist(); applyPalette(); },
    setSurfaceOpacity(v) { set({ surfaceOpacity: v }); persist(); applyPalette(); },
    setBgOverlayOpacity(v) { set({ bgOverlayOpacity: v }); persist(); },
    setFontPrimaryColor(v) { set({ fontPrimaryColor: v }); persist(); applyFontColors(); },
    setFontSecondaryColor(v) { set({ fontSecondaryColor: v }); persist(); applyFontColors(); },
    setWidgetTextColor(v) { set({ widgetTextColor: v }); persist(); applyFontColors(); },
    setScrollFadeOpacity(v) { set({ scrollFadeOpacity: v }); persist(); applyScrollFade(); applyFontFamily(); },
    setPlayerBgColor(v) { set({ playerBgColor: v }); persist(); },
    setPlayerBgMode(v) { set({ playerBgMode: v }); persist(); },
    setCyberBgmEnabled(v) { set({ cyberBgmEnabled: v }); persist(); },
    setCgTextSize(v) { set({ cgTextSize: v }); persist(); },
    setCgTextColor(v) { set({ cgTextColor: v }); persist(); },
    setCgTextBgColor(v) { set({ cgTextBgColor: v }); persist(); },
    setCgTextBgOpacity(v) { set({ cgTextBgOpacity: v }); persist(); },
    setFontFamily(v) { set({ fontFamily: v }); persist(); applyFontFamily(); },
    setFontFamilyCJK(v) { set({ fontFamilyCJK: v, fontFamily: "" }); persist(); applyFontFamily(); },
    setFontFamilyEN(v) { set({ fontFamilyEN: v, fontFamily: "" }); persist(); applyFontFamily(); },
    setSystemDialogStyle(v) { set({ systemDialogStyle: v }); persist(); },
    setPaletteAccent(v) { set({ paletteAccent: v, paletteCustomized: true, paletteRandomEnabled: false }); persist(); applyPalette(); },
    setPaletteSaturation(v) { set({ paletteSaturation: v, paletteCustomized: true, paletteRandomEnabled: false }); persist(); applyPalette(); },
    setPaletteRandomSeed(seed: number) { set({ paletteRandomSeed: seed, paletteRandomEnabled: true, paletteCustomized: true }); persist(); },
    setPaletteRandomEnabled(on: boolean) { set({ paletteRandomEnabled: on }); if (!on) applyPalette(); persist(); },
    setWallpaperConfig(cfg) { set((s) => ({ wallpaper: { ...s.wallpaper, ...cfg } })); persist(); },
    setExternalPlayer(cfg) { set((s) => ({ externalPlayer: { ...s.externalPlayer, ...cfg } })); persist(); },
    resetPaletteToTheme(theme) {
      const def = THEME_PALETTE_DEFAULTS[theme] ?? THEME_PALETTE_DEFAULTS.default;
      set({ paletteAccent: def.accent, paletteSaturation: def.saturation, paletteCustomized: false });
      persist(); applyPalette();
    },

    setThemeEffects(themeId, fx) {
      set((s) => ({ themeEffects: { ...s.themeEffects, [themeId]: fx } }));
      persist();
    },
    resetThemeEffects(themeId) {
      set((s) => {
        const copy = { ...s.themeEffects };
        delete copy[themeId];
        return { themeEffects: copy };
      });
      persist();
    },
  };
});
