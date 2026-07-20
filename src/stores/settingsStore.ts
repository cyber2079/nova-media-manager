import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";
import type { ThemeName } from "./themeStore";

export type BgVideoMode = "normal" | "fill" | "stretch";
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

export const FONT_LIST: { value: string; label: string; i18nKey: string; css: string; google?: string }[] = [
  { value: "inter", label: "Inter", i18nKey: "inter", css: '"Inter", system-ui, sans-serif' },
  { value: "noto-sans-sc", label: "思源黑体", i18nKey: "fonts.source_han_sans", css: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', google: "Noto+Sans+SC:wght@400;500;600;700" },
  { value: "noto-serif-sc", label: "思源宋体", i18nKey: "fonts.source_han_serif", css: '"Noto Serif SC", "STSong", "SimSun", serif', google: "Noto+Serif+SC:wght@400;600;700" },
  { value: "lxgw", label: "霞鹜文楷", i18nKey: "fonts.lxgw_wenkai", css: '"LXGW WenKai", "楷体", "KaiTi", serif', google: "LXGW+WenKai:wght@400;700" },
  { value: "jetbrains-mono", label: "JetBrains Mono", i18nKey: "jetbrains-mono", css: '"JetBrains Mono", "Fira Code", monospace', google: "JetBrains+Mono:wght@400;500;600;700" },
  { value: "source-han-sans", label: "Source Han Sans", i18nKey: "source-han-sans", css: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
  { value: "playfair", label: "Playfair Display", i18nKey: "playfair", css: '"Playfair Display", "Times New Roman", serif', google: "Playfair+Display:wght@400;600;700" },
  { value: "dm-sans", label: "DM Sans", i18nKey: "dm-sans", css: '"DM Sans", system-ui, sans-serif', google: "DM+Sans:wght@400;500;600;700" },
  { value: "space-grotesk", label: "Space Grotesk", i18nKey: "space-grotesk", css: '"Space Grotesk", system-ui, sans-serif', google: "Space+Grotesk:wght@400;500;600;700" },
  { value: "maoken-glitch", label: "中文故障", i18nKey: "fonts.chinese_glitch", css: '"Maoken Glitch Sans", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { value: "maoken-defectica", label: "赛博朋克", i18nKey: "fonts.cyberpunk", css: '"Defectica", "Maoken Glitch Sans", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { value: "defectica", label: "英文破碎", i18nKey: "fonts.english_broken", css: '"Defectica", "PingFang SC", "Microsoft YaHei", sans-serif' },
];

// ═══════════════ PER-THEME PALETTE DEFAULTS ═══════════════
// Each theme pairs with a default accent color, saturation level, and dark/light.
// Switching themes auto-applies these; users can then tweak with the Palette controls.

export interface PaletteConfig {
  accent: string;     // hex color
  saturation: number; // 0-100
  contrast: "dark" | "light";
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

export const THEME_PALETTE_DEFAULTS: Record<ThemeName, PaletteConfig> = {
  default:     { accent: "#4788f0", saturation: 50, contrast: "dark" },
  "ice-girl":   { accent: "#87ceeb", saturation: 40, contrast: "dark" },
  "cyber-girl": { accent: "#8b5cf6", saturation: 80, contrast: "dark" }};

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
  visualizerMode: VisualizerMode;
  imageWheelMode: ImageWheelMode;
  headerOpacity: number;
  footerOpacity: number;
  surfaceSaturation: number;
  surfaceOpacity: number;
  bgOverlayOpacity: number;
  hideTitleBar: boolean;
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
  paletteContrast: "dark" | "light";
  /** Whether user has manually adjusted palette from theme default */
  paletteCustomized: boolean;

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
  setHeaderOpacity: (v: number) => void;
  setFooterOpacity: (v: number) => void;
  setSurfaceSaturation: (v: number) => void;
  setSurfaceOpacity: (v: number) => void;
  setBgOverlayOpacity: (v: number) => void;
  setHideTitleBar: (v: boolean) => void;
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
  setPaletteAccent: (v: string) => void;
  setPaletteSaturation: (v: number) => void;
  setPaletteContrast: (v: "dark" | "light") => void;
  setWallpaperConfig: (cfg: Partial<WallpaperConfig>) => void;
  setExternalPlayer: (cfg: Partial<ExternalPlayerConfig>) => void;
  resetPaletteToTheme: (theme: ThemeName) => void;
  hardwareAcceleration: boolean;
  setHardwareAcceleration: (v: boolean) => void;

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
    bgVideoMode: s.bgVideoMode, bgVideoLoop: s.bgVideoLoop,
    lastVolume: s.lastVolume, previewOffset: s.previewOffset,
    lyricFontSize: s.lyricFontSize, lyricUseCustomColor: s.lyricUseCustomColor,
    lyricCurrentColor: s.lyricCurrentColor, lyricOtherColor: s.lyricOtherColor, lyricFillColor: s.lyricFillColor,
    fontSize: s.fontSize, iconSize: s.iconSize, fontFamily: s.fontFamily,
    visualizerMode: s.visualizerMode, imageWheelMode: s.imageWheelMode,
    headerOpacity: s.headerOpacity, footerOpacity: s.footerOpacity,
    surfaceSaturation: s.surfaceSaturation, surfaceOpacity: s.surfaceOpacity, bgOverlayOpacity: s.bgOverlayOpacity,
    hideTitleBar: s.hideTitleBar, fontPrimaryColor: s.fontPrimaryColor, fontSecondaryColor: s.fontSecondaryColor, widgetTextColor: s.widgetTextColor, scrollFadeOpacity: s.scrollFadeOpacity, playerBgColor: s.playerBgColor, playerBgMode: s.playerBgMode, cyberBgmEnabled: s.cyberBgmEnabled, cgTextSize: s.cgTextSize, cgTextColor: s.cgTextColor, cgTextBgColor: s.cgTextBgColor, cgTextBgOpacity: s.cgTextBgOpacity, paletteAccent: s.paletteAccent, paletteSaturation: s.paletteSaturation, paletteContrast: s.paletteContrast, paletteCustomized: s.paletteCustomized, hardwareAcceleration: s.hardwareAcceleration, wallpaper: s.wallpaper, externalPlayer: s.externalPlayer,
    perfPriority: s.perfPriority, perfIdleReduce: s.perfIdleReduce, perfReduceAnimations: s.perfReduceAnimations, cacheCleanupDays: s.cacheCleanupDays, cacheCleanupLastRun: s.cacheCleanupLastRun,
    dashboardMode: s.dashboardMode, contentMinimized: s.contentMinimized,
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
  const contrast = s.paletteContrast;
  const accent = s.paletteAccent;
  const root = document.documentElement;

  const isDark = contrast !== "light";
  const text = isDark ? "#edeff4" : "#1c1c1e";
  const muted = isDark ? "#8a99b8" : "#5c5b66";

  // ── HSL-saturate the accent colour ──
  const [h, baseS, l] = hexToHSL(accent);
  const sFactor = v / 50;                         // 0 → 2×
  const newS = Math.min(100, Math.max(5, baseS * sFactor));
  const primary = hslToHex(h, newS, l);
  const primaryLight = hslToHex(h, newS, Math.min(94, l + 20));
  const primaryDark = hslToHex(h, Math.min(100, newS * 1.05), Math.max(6, l - 18));

  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-primary-light", primaryLight);
  root.style.setProperty("--color-primary-dark", primaryDark);

  // ── Surface: let CSS :root rules handle it (they use var(--color-primary)) ──
  // Remove stale inline overrides so the cascade picks up the saturated primary
  root.style.removeProperty("--color-surface");
  root.style.removeProperty("--color-surface-light");
  root.style.removeProperty("--color-surface-lighter");

  // ── Typography ──
  root.style.setProperty("--font-primary", text);
  root.style.setProperty("--font-secondary", muted);
  root.style.setProperty("--scroll-fade-opacity", String(v / 400));

  // ── CG text colors follow accent ──
  root.style.setProperty("--cg-text-color", primary);
  root.style.setProperty("--cg-text-bg", primary);

  // ── Light palette contrast ──
  if (contrast === "light") {
    root.setAttribute("data-palette", "light");
  } else {
    root.removeAttribute("data-palette");
  }
}

/** Re-apply the palette (called by legacy setters like headerOpacity).
 *  Surface colours are now entirely CSS-driven via var(--color-primary). */
export function applySurface() {
  applyPalette();
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

/** Toggle Windows title bar decorations via Tauri API */
export async function applyTitleBar() {
  const hide = useSettingsStore.getState().hideTitleBar;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setDecorations(!hide);
  } catch {}
}

/** Apply global font family + load Google Font if needed */
export function applyFontFamily(v?: string) {
  const family = v ?? useSettingsStore.getState().fontFamily ?? "system";
  const entry = FONT_LIST.find((f) => f.value === family);
  if (entry) {
    // Set on body (not html) because body has font-family: var(--font-display) in CSS
    document.body.style.fontFamily = entry.css;
    if (entry.google) {
      const id = "google-font-dynamic";
      let link = document.getElementById(id) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${entry.google}&display=swap`;
    }
  } else {
    document.body.style.removeProperty("font-family");
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
    autoStart: saved.autoStart || false,
    startFullscreen: saved.startFullscreen !== false,
    autoHideHeader: saved.autoHideHeader || false,
    autoHideFooter: saved.autoHideFooter || false,
    customColor: saved.customColor || "#4488ff",
    useCustomColor: saved.useCustomColor || false,
    bgVideoMode: (saved as any).bgVideoMode || "fill",
    bgVideoLoop: (saved as any).bgVideoLoop || getDefaultLoop(),
    lastVolume: (saved as any).lastVolume ?? 0.8,
    previewOffset: (saved as any).previewOffset ?? 0.8,
    lyricFontSize: (saved as any).lyricFontSize || "normal",
    lyricUseCustomColor: (saved as any).lyricUseCustomColor || false,
    lyricCurrentColor: (saved as any).lyricCurrentColor || "#ffffff",
    lyricOtherColor: (saved as any).lyricOtherColor || "#8899aa",
    lyricFillColor: (saved as any).lyricFillColor || "#ffb6c1",
    fontSize: (saved as any).fontSize || "normal",
    iconSize: (saved as any).iconSize || "normal",
    fontFamily: (saved as any).fontFamily || "inter",
    visualizerMode: (saved as any).visualizerMode || "bars",
    imageWheelMode: (saved as any).imageWheelMode || "prevNext",
    headerOpacity: (saved as any).headerOpacity ?? 30,
    footerOpacity: (saved as any).footerOpacity ?? 30,
    surfaceSaturation: (saved as any).surfaceSaturation ?? 4,
    surfaceOpacity: (saved as any).surfaceOpacity ?? 92,
    bgOverlayOpacity: (saved as any).bgOverlayOpacity ?? 70,
    hideTitleBar: (saved as any).hideTitleBar ?? true,
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
    paletteContrast: (saved as any).paletteContrast || "dark",
    paletteCustomized: (saved as any).paletteCustomized || false,
    hardwareAcceleration: (saved as any).hardwareAcceleration ?? true,
    perfPriority: (saved as any).perfPriority || "normal",
    perfIdleReduce: (saved as any).perfIdleReduce ?? true,
    perfReduceAnimations: (saved as any).perfReduceAnimations || false,
    cacheCleanupDays: (saved as any).cacheCleanupDays || 30,
    cacheCleanupLastRun: (saved as any).cacheCleanupLastRun || null,
    dashboardMode: (saved as any).dashboardMode || "full",
    contentMinimized: (saved as any).contentMinimized || {},

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
            bgVideoMode: s.bgVideoMode ?? get().bgVideoMode,
            bgVideoLoop: s.bgVideoLoop ?? get().bgVideoLoop,
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
            visualizerMode: (s.visualizerMode as any) ?? get().visualizerMode,
            imageWheelMode: (s.imageWheelMode as any) ?? get().imageWheelMode,
            headerOpacity: (s.headerOpacity as number) ?? get().headerOpacity,
            footerOpacity: (s.footerOpacity as number) ?? get().footerOpacity,
            surfaceSaturation: (s.surfaceSaturation as number) ?? get().surfaceSaturation,
            surfaceOpacity: (s.surfaceOpacity as number) ?? get().surfaceOpacity,
            hideTitleBar: (s.hideTitleBar as boolean) ?? get().hideTitleBar,
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
            paletteContrast: (s.paletteContrast as any) ?? get().paletteContrast,
            paletteCustomized: (s.paletteCustomized as boolean) ?? get().paletteCustomized, hardwareAcceleration: (s.hardwareAcceleration as boolean) ?? get().hardwareAcceleration, wallpaper: s.wallpaper ?? get().wallpaper,
            externalPlayer: s.externalPlayer ?? get().externalPlayer,
            dashboardMode: (s.dashboardMode as any) ?? get().dashboardMode,
            contentMinimized: (s.contentMinimized as any) ?? get().contentMinimized});
          applyPalette(); applySurface();
          applyFontColors();
          applyLyricColors();
          applyScrollFade(); applyFontFamily();
        } catch {}
      } else { applySurface(); applyFontColors(); applyLyricColors(); applyScrollFade(); applyFontFamily(); }
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
    setHeaderOpacity(v) { set({ headerOpacity: v }); persist(); applySurface(); },
    setFooterOpacity(v) { set({ footerOpacity: v }); persist(); },
    setSurfaceSaturation(v) { set({ surfaceSaturation: v }); persist(); applySurface(); },
    setSurfaceOpacity(v) { set({ surfaceOpacity: v }); persist(); applySurface(); },
    setBgOverlayOpacity(v) { set({ bgOverlayOpacity: v }); persist(); },
    setHideTitleBar(v) { set({ hideTitleBar: v }); persist(); applyTitleBar(); },
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
    setFontFamily(v) { set({ fontFamily: v }); persist(); applyFontFamily(v); },
    setPaletteAccent(v) { set({ paletteAccent: v, paletteCustomized: true }); persist(); applyPalette(); },
    setPaletteSaturation(v) { set({ paletteSaturation: v, paletteCustomized: true }); persist(); applyPalette(); },
    setPaletteContrast(v) { set({ paletteContrast: v, paletteCustomized: true }); persist(); applyPalette(); },
    setWallpaperConfig(cfg) { set((s) => ({ wallpaper: { ...s.wallpaper, ...cfg } })); persist(); },
    setExternalPlayer(cfg) { set((s) => ({ externalPlayer: { ...s.externalPlayer, ...cfg } })); persist(); },
    resetPaletteToTheme(theme) {
      const def = THEME_PALETTE_DEFAULTS[theme] ?? THEME_PALETTE_DEFAULTS.default;
      set({ paletteAccent: def.accent, paletteSaturation: def.saturation, paletteContrast: def.contrast, paletteCustomized: false });
      persist(); applyPalette();
    }};
});
