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

export const FONT_LIST: { value: string; label: string; css: string; google?: string }[] = [
  { value: "system", label: "系统默认", css: 'var(--font-display), "Inter", system-ui, sans-serif' },
  { value: "inter", label: "Inter", css: '"Inter", system-ui, sans-serif' },
  { value: "noto-sans-sc", label: "思源黑体", css: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', google: "Noto+Sans+SC:wght@400;500;600;700" },
  { value: "noto-serif-sc", label: "思源宋体", css: '"Noto Serif SC", "STSong", "SimSun", serif', google: "Noto+Serif+SC:wght@400;600;700" },
  { value: "lxgw", label: "霞鹜文楷", css: '"LXGW WenKai", "楷体", "KaiTi", serif', google: "LXGW+WenKai:wght@400;700" },
  { value: "jetbrains-mono", label: "JetBrains Mono", css: '"JetBrains Mono", "Fira Code", monospace', google: "JetBrains+Mono:wght@400;500;600;700" },
  { value: "source-han-sans", label: "Source Han Sans", css: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
  { value: "playfair", label: "Playfair Display", css: '"Playfair Display", "Times New Roman", serif', google: "Playfair+Display:wght@400;600;700" },
  { value: "dm-sans", label: "DM Sans", css: '"DM Sans", system-ui, sans-serif', google: "DM+Sans:wght@400;500;600;700" },
  { value: "space-grotesk", label: "Space Grotesk", css: '"Space Grotesk", system-ui, sans-serif', google: "Space+Grotesk:wght@400;500;600;700" },
  { value: "maoken-glitch", label: "中文故障", css: '"Maoken Glitch Sans", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { value: "maoken-defectica", label: "赛博朋克", css: '"Defectica", "Maoken Glitch Sans", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { value: "defectica", label: "英文破碎", css: '"Defectica", "PingFang SC", "Microsoft YaHei", sans-serif' },
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
  { value: "#4788f0", label: "藏蓝" },
  { value: "#c0394a", label: "酒红" },
  { value: "#c2861c", label: "深棕" },
  { value: "#7c6ff0", label: "暗紫" },
  { value: "#06b6d4", label: "青绿" },
  { value: "#f59e0b", label: "琥珀" },
  { value: "#ec4899", label: "玫红" },
  { value: "#6366f1", label: "靛蓝" },
];

export const THEME_PALETTE_DEFAULTS: Record<ThemeName, PaletteConfig> = {
  default:     { accent: "#4788f0", saturation: 50, contrast: "dark" },
  "ice-girl":   { accent: "#87ceeb", saturation: 40, contrast: "dark" },
  "cyber-girl": { accent: "#8b5cf6", saturation: 80, contrast: "dark" },
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

  // ── New palette system (replaces 13 individual controls) ──
  paletteAccent: string;
  paletteSaturation: number;  // 0-100
  paletteContrast: "dark" | "light";
  /** Whether user has manually adjusted palette from theme default */
  paletteCustomized: boolean;

  // Init from persistent store
  init: () => Promise<void>;
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
  setScrollFadeOpacity: (v: number) => void;
  setPlayerBgColor: (v: string) => void;
  setPlayerBgMode: (v: "follow" | "custom") => void;
  setCyberBgmEnabled: (v: boolean) => void;
  setCompactMode: (v: boolean) => void;
  setLayoutMode: (v: string) => void;
  setCgTextSize: (v: "xs" | "sm" | "base") => void;
  setCgTextColor: (v: string) => void;
  setFontFamily: (v: string) => void;
  setPaletteAccent: (v: string) => void;
  setPaletteSaturation: (v: number) => void;
  setPaletteContrast: (v: "dark" | "light") => void;
  setWallpaperConfig: (cfg: Partial<WallpaperConfig>) => void;
  resetPaletteToTheme: (theme: ThemeName) => void;
};

const STORAGE_KEY = "app-settings";

function getDefaultLoop(): BgVideoLoopConfig {
  return {
    enabled: true, loopCount: 0, firstPlayStart: 0, firstPlayEnd: 0,
    loopStart: 0, loopDuration: 3, transitionMs: 450, playbackRate: 0.7,
  };
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

function outdate() { _dirty = true; }

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
  const { fontPrimaryColor: pc, fontSecondaryColor: sc } = useSettingsStore.getState();
  const root = document.documentElement;
  root.style.setProperty('--font-primary', pc);
  root.style.setProperty('--font-secondary', sc);
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

let _dirty = true;
let _writing = false;

async function persist(s: SettingsState) {
  if (!_dirty) return;
  _dirty = false;
  if (_writing) return;
  _writing = true;
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
    hideTitleBar: s.hideTitleBar, fontPrimaryColor: s.fontPrimaryColor, fontSecondaryColor: s.fontSecondaryColor, scrollFadeOpacity: s.scrollFadeOpacity, playerBgColor: s.playerBgColor, playerBgMode: s.playerBgMode, cyberBgmEnabled: s.cyberBgmEnabled, cgTextSize: s.cgTextSize, cgTextColor: s.cgTextColor, cgTextBgColor: s.cgTextBgColor, cgTextBgOpacity: s.cgTextBgOpacity, paletteAccent: s.paletteAccent, paletteSaturation: s.paletteSaturation, paletteContrast: s.paletteContrast, paletteCustomized: s.paletteCustomized, wallpaper: s.wallpaper, wallpaper: s.wallpaper,
  });
  // Write to both: SQLite (primary) + localStorage (fast sync fallback)
  localStorage.setItem(STORAGE_KEY, payload);
  await kv.set(STORAGE_KEY, payload).catch(() => {});
  _writing = false;
}

function hexToHSL(hex: string): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const h = hex.replace("#", "");
  if (h.length === 3) { r = parseInt(h[0]+h[0],16); g = parseInt(h[1]+h[1],16); b = parseInt(h[2]+h[2],16); }
  else if (h.length >= 6) { r = parseInt(h.slice(0,2),16); g = parseInt(h.slice(2,4),16); b = parseInt(h.slice(4,6),16); }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0; const lit = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  return [Math.round(hue * 360), Math.round(sat * 100), Math.round(lit * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return "#" + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

export function computeThemeColors(base: string) {
  const [h, s, l] = hexToHSL(base);
  return {
    primary: hslToHex(h, Math.min(80, s), Math.max(35, Math.min(55, l))),
    light: hslToHex(h, Math.max(25, s - 10), Math.min(88, l + 22)),
    dark: hslToHex(h, Math.min(85, s + 8), Math.max(14, l - 14)),
    surface: hslToHex(h, Math.max(4, s/4), Math.max(6, Math.min(10, l/3))),
    surfaceLight: hslToHex(h, Math.max(5, s/4), Math.max(10, Math.min(15, l/2.5))),
    surfaceLighter: hslToHex(h, Math.max(6, s/3), Math.max(14, Math.min(22, l/2))),
    border: hslToHex(h, Math.max(15, s/3), Math.min(55, l + 8)),
    accent: hslToHex(h, Math.min(75, s + 5), Math.min(60, l + 5)),
  };
}

export const COLOR_PRESETS = [
  "#f59e0b", "#00e5a0", "#4488ff", "#8b5cf6",
  "#e06040", "#87ceeb", "#ff88cc", "#f99e1a",
];

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
    fontFamily: (saved as any).fontFamily || "system",
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
    scrollFadeOpacity: (saved as any).scrollFadeOpacity ?? 30,
    playerBgColor: (saved as any).playerBgColor || "",
    playerBgMode: (saved as any).playerBgMode || "follow",
    cyberBgmEnabled: (saved as any).cyberBgmEnabled ?? true,
    cgTextSize: (saved as any).cgTextSize || "xs",
    cgTextColor: (saved as any).cgTextColor || "#e0c0ff",
    cgTextBgColor: (saved as any).cgTextBgColor || "#c74dff",
    cgTextBgOpacity: (saved as any).cgTextBgOpacity ?? 15,
    wallpaper: (saved as any).wallpaper || getDefaultWallpaper(),
    paletteAccent: (saved as any).paletteAccent || "#4788f0",
    paletteSaturation: (saved as any).paletteSaturation ?? ((saved as any).paletteVibrancy != null ? (saved as any).paletteVibrancy * 10 : 50),
    paletteContrast: (saved as any).paletteContrast || "dark",
    paletteCustomized: (saved as any).paletteCustomized || false,

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
            paletteCustomized: (s.paletteCustomized as boolean) ?? get().paletteCustomized, wallpaper: s.wallpaper ?? get().wallpaper,
          });
          applyPalette(); applySurface();
          applyFontColors();
          applyLyricColors();
          applyScrollFade(); applyFontFamily();
        } catch {}
      } else { applySurface(); applyFontColors(); applyLyricColors(); applyScrollFade(); applyFontFamily(); }
    },

    setLanguage(lang) { set({ language: lang }); outdate(); persist(get()); },
    async setAutoStart(on) {
      try { const { enable, disable } = await import("@tauri-apps/plugin-autostart"); if (on) await enable(); else await disable(); } catch {}
      set({ autoStart: on }); outdate(); persist(get());
    },
    setStartFullscreen(on) { set({ startFullscreen: on }); outdate(); persist(get()); },
    setAutoHideHeader(on) { set({ autoHideHeader: on }); outdate(); persist(get()); },
    setAutoHideFooter(on) { set({ autoHideFooter: on }); outdate(); persist(get()); },
    setCustomColor(color) { set({ customColor: color }); outdate(); persist(get()); },
    setUseCustomColor(on) { set({ useCustomColor: on }); outdate(); persist(get()); },
    setBgVideoMode(mode) { set({ bgVideoMode: mode }); outdate(); persist(get()); },
    setBgVideoLoop(cfg) { set((s) => ({ bgVideoLoop: { ...s.bgVideoLoop, ...cfg } })); outdate(); persist(get()); },
    setLastVolume(v) { set({ lastVolume: v }); outdate(); persist(get()); },
    setPreviewOffset(v) { set({ previewOffset: v }); outdate(); persist(get()); },
    setLyricFontSize(v) { set({ lyricFontSize: v }); outdate(); persist(get()); },
    setLyricUseCustomColor(v) { set({ lyricUseCustomColor: v }); outdate(); persist(get()); applyLyricColors(); },
    setLyricCurrentColor(v) { set({ lyricCurrentColor: v }); outdate(); persist(get()); applyLyricColors(); },
    setLyricOtherColor(v) { set({ lyricOtherColor: v }); outdate(); persist(get()); applyLyricColors(); },
    setLyricFillColor(v) { set({ lyricFillColor: v }); outdate(); persist(get()); applyLyricColors(); },
    setFontSize(v) { set({ fontSize: v }); outdate(); persist(get()); },
    setIconSize(v) { set({ iconSize: v }); outdate(); persist(get()); },
    setVisualizerMode(v) { set({ visualizerMode: v }); outdate(); persist(get()); },
    setImageWheelMode(v) { set({ imageWheelMode: v }); outdate(); persist(get()); },
    setHeaderOpacity(v) { set({ headerOpacity: v }); outdate(); persist(get()); applySurface(); },
    setFooterOpacity(v) { set({ footerOpacity: v }); outdate(); persist(get()); },
    setSurfaceSaturation(v) { set({ surfaceSaturation: v }); outdate(); persist(get()); applySurface(); },
    setSurfaceOpacity(v) { set({ surfaceOpacity: v }); outdate(); persist(get()); applySurface(); },
    setBgOverlayOpacity(v) { set({ bgOverlayOpacity: v }); outdate(); persist(get()); },
    setHideTitleBar(v) { set({ hideTitleBar: v }); outdate(); persist(get()); applyTitleBar(); },
    setFontPrimaryColor(v) { set({ fontPrimaryColor: v }); outdate(); persist(get()); applyFontColors(); },
    setFontSecondaryColor(v) { set({ fontSecondaryColor: v }); outdate(); persist(get()); applyFontColors(); },
    setScrollFadeOpacity(v) { set({ scrollFadeOpacity: v }); outdate(); persist(get()); applyScrollFade(); applyFontFamily(); },
    setPlayerBgColor(v) { set({ playerBgColor: v }); outdate(); persist(get()); },
    setPlayerBgMode(v) { set({ playerBgMode: v }); outdate(); persist(get()); },
    setCyberBgmEnabled(v) { set({ cyberBgmEnabled: v }); outdate(); persist(get()); },
    setCgTextSize(v) { set({ cgTextSize: v }); outdate(); persist(get()); },
    setCgTextColor(v) { set({ cgTextColor: v }); outdate(); persist(get()); },
    setCgTextBgColor(v) { set({ cgTextBgColor: v }); outdate(); persist(get()); },
    setCgTextBgOpacity(v) { set({ cgTextBgOpacity: v }); outdate(); persist(get()); },
    setFontFamily(v) { set({ fontFamily: v }); outdate(); persist(get()); applyFontFamily(v); },
    setPaletteAccent(v) { set({ paletteAccent: v, paletteCustomized: true }); outdate(); persist(get()); applyPalette(); },
    setPaletteSaturation(v) { set({ paletteSaturation: v, paletteCustomized: true }); outdate(); persist(get()); applyPalette(); },
    setPaletteContrast(v) { set({ paletteContrast: v, paletteCustomized: true }); outdate(); persist(get()); applyPalette(); },
    setWallpaperConfig(cfg) { set((s) => ({ wallpaper: { ...s.wallpaper, ...cfg } })); outdate(); persist(get()); },
    resetPaletteToTheme(theme) {
      const def = THEME_PALETTE_DEFAULTS[theme] ?? THEME_PALETTE_DEFAULTS.default;
      set({ paletteAccent: def.accent, paletteSaturation: def.saturation, paletteContrast: def.contrast, paletteCustomized: false });
      outdate(); persist(get()); applyPalette();
    },
  };
});
