// Theme Token Engine
//
// For non-default themes:
//   1. On mount: sync-apply cached tokens from localStorage (no flash)
//   2. Async: fetch fresh from Rust → inject → update cache
//
// For default theme: does nothing (useThemeEffects handles legacy palette).

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore, type PerThemeFx, DEFAULT_SCANLINE } from "@/stores/settingsStore";
import { themeUrl } from "@/lib/themeBase";
import { hexToHSL, hslToHex } from "@/lib/colorUtils";

// ── Hex → rgba for scanline overrides ──
function hexToRGBA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${(alpha / 100).toFixed(2)})`;
}

// ── Inject per-theme effect CSS overrides (scanline, etc.) ──
function applyThemeEffectOverrides(themeId: string, fx: PerThemeFx | undefined) {
  let el = document.getElementById("nv-fx-overrides") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "nv-fx-overrides";
    document.head.appendChild(el);
  }

  const scanline = fx?.scanline ?? { ...DEFAULT_SCANLINE };
  const selector = `html[data-theme="${themeId}"] body::before`;
  let css = "";

  if (!scanline.enabled) {
    css = `${selector} { display: none !important; }`;
  } else {
    const rgba = hexToRGBA(scanline.color, scanline.opacity);
    const t = scanline.thickness;
    const pitch = t * 2;
    css = `${selector} {
  display: block !important;
  background: repeating-linear-gradient(0deg, transparent, transparent ${t}px, ${rgba} ${t}px, ${rgba} ${pitch}px) !important;
}`;
  }

  el.textContent = css;
  console.log("[useThemeTokens] fx overrides:", themeId, scanline);
}

const CACHE_KEY = "nv-theme-tokens-v2";

function buildUserOverrides(): string {
  const s = useSettingsStore.getState();
  const ov: Record<string, unknown> = {};
  // Palette override: if user customized palette, send their chosen accent as primary color
  // Single-color palette mode: send accent as override. Todos random: use theme.json defaults.
  if (s.paletteCustomized && s.paletteAccent && !s.paletteRandomEnabled) ov["colors"] = { primary: s.paletteAccent, primaryLight: s.paletteAccent };
  if (s.glassMasterEnabled) {
    ov["glass"] = { header:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, footer:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, main:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, dialog:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, card:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, widget:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, quickhub:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur} };
  } else {
    ov["glass"] = { header:{opacity:s.barOpacity,blur:s.barBlur}, footer:{opacity:s.barOpacity,blur:s.barBlur}, main:{opacity:s.mainOpacity,blur:s.mainBlur}, dialog:{opacity:s.dialogOpacity,blur:s.dialogBlur} };
  }
  ov["global"] = { bgOverlayOpacity: s.bgOverlayOpacity };
  return JSON.stringify(ov);
}

const BRIDGE_COLORS: [string, string][] = [
  ["--nv-color-primary",        "--color-primary"],
  ["--nv-color-primaryLight",   "--color-primary-light"],
  ["--nv-color-primaryDark",    "--color-primary-dark"],
  ["--nv-color-accent",         "--color-accent"],
  ["--nv-color-surface",        "--color-surface"],
  ["--nv-color-surfaceLight",    "--color-surface-light"],
  ["--nv-color-surfaceLighter",  "--color-surface-lighter"],
  ["--nv-color-surfaceDark",    "--color-surface-dark"],
  ["--nv-color-text",           "--font-primary"],
  ["--nv-color-textSecondary",  "--font-secondary"],
  ["--nv-color-textMuted",      "--font-widget"],
  ["--nv-widget-text",          "--font-widget"],
  ["--nv-widget-iconColor",     "--color-primary-light"],
  ["--nv-color-border",         "--color-border"],
  ["--nv-color-borderFocus",    "--color-border-focus"],
];

function readCache(themeId: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (cache.themeId === themeId && cache.tokens) return cache.tokens;
  } catch {}
  return null;
}

function writeCache(themeId: string, tokens: Record<string, string>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ themeId, tokens, ts: Date.now() })); } catch {}
}

function injectTokens(tokens: Record<string, string>) {
  const root = document.documentElement;
  // ALL --nv-* vars with !important
  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith("--nv-")) root.style.setProperty(key, value, "important");
  }
  // Bridge to --color-* with !important
  for (const [nvKey, colorKey] of BRIDGE_COLORS) {
    const val = tokens[nvKey];
    if (val) root.style.setProperty(colorKey, val, "important");
  }

  // Palette: derive all surface/border/accent from chosen primary
  const s = useSettingsStore.getState();
  const hex = s.paletteCustomized && s.paletteAccent ? s.paletteAccent : "#ff00ff";
  const hexes = s.paletteRandomEnabled
    ? (() => { const colors = ["#00f5ff","#ff00ff","#39ff14","#ff6600","#bf00ff","#ffff00","#ff0040"]; return colors[Math.abs(s.paletteRandomSeed) % 7]; })()
    : hex;
  if (s.paletteCustomized) {
    const [h, sat, lum] = hexToHSL(hexes);
    const pLight = hslToHex(h, Math.min(100, sat + 10), Math.min(94, lum + 20));
    const pDark  = hslToHex(h, Math.min(100, sat + 5), Math.max(6, lum - 18));
    const baseBg = "#080c14", midBg = "#101520", liteBg = "#1a1f2a";
    const derived: [string,string][] = [
      ["--color-primary",        hexes],
      ["--color-primary-light",  pLight],
      ["--color-primary-dark",   pDark],
      ["--color-accent",         hexes],
      ["--color-surface",        `color-mix(in srgb, ${hexes} 4%, ${baseBg})`],
      ["--color-surface-light",  `color-mix(in srgb, ${hexes} 6%, ${midBg})`],
      ["--color-surface-lighter",`color-mix(in srgb, ${hexes} 8%, ${liteBg})`],
      ["--color-border",         `color-mix(in srgb, ${hexes} 18%, transparent)`],
      ["--nv-color-primary",     hexes],
      ["--nv-color-primaryLight",pLight],
      ["--nv-color-primaryDark", pDark],
      ["--nv-color-accent",      hexes],
      ["--nv-color-surface",     `color-mix(in srgb, ${hexes} 4%, ${baseBg})`],
      ["--nv-color-surfaceLight", `color-mix(in srgb, ${hexes} 6%, ${midBg})`],
      ["--nv-color-surfaceLighter",`color-mix(in srgb, ${hexes} 8%, ${liteBg})`],
      ["--font-widget",          pLight],
      ["--nv-widget-text",       pLight],
    ];
    for (const [k, v] of derived) root.style.setProperty(k, v, "important");
  }
  // Load neon-icons.css + theme.css as inline <style> tags
  const themeId = tokens["__themeId"];
  if (tokens["--nv-nav-home-icon"] && themeId) {
    // Step A: load IconsNeon CSS first (neon-icons.css)
    const neonCssUrl = themeUrl(themeId, "neon-icons.css");
    fetch(neonCssUrl)
      .then(r => { if (r.ok) return r.text(); throw new Error("404"); })
      .then(cssText => {
        let el = document.getElementById("nv-neon-icons") as HTMLStyleElement | null;
        if (!el) { el = document.createElement("style"); el.id = "nv-neon-icons"; document.head.appendChild(el); }
        el.textContent = cssText;
        console.log("[useThemeTokens] neon-icons.css loaded, " + cssText.length + " bytes");
      })
      .catch(e => console.warn("[useThemeTokens] neon-icons.css load failed:", e.message));

    // Step B: load theme CSS (CyberUI effects)
    const cssUrl = themeUrl(themeId, "theme.css");
    fetch(cssUrl)
      .then(r => { if (r.ok) return r.text(); throw new Error("404"); })
      .then(cssText => {
        let el = document.getElementById("nv-theme-css") as HTMLStyleElement | null;
        if (!el) { el = document.createElement("style"); el.id = "nv-theme-css"; document.head.appendChild(el); }
        // Strip @import since we loaded neon-icons.css separately
        el.textContent = cssText.replace(/@import\s+["'][^"']*neon-icons[^"']*["'];?/g, '');
        console.log("[useThemeTokens] theme.css loaded, " + cssText.length + " bytes");
      })
      .catch(e => console.warn("[useThemeTokens] theme.css load failed:", e.message));
  }
}

export function useThemeTokens() {
  const theme = useThemeStore((s) => s.theme);
  const themeVersion = useThemeStore((s) => s.themeVersion);
  const {
    paletteAccent, paletteSaturation, paletteCustomized, paletteRandomSeed, paletteRandomEnabled,
    glassMasterEnabled, globalGlassOpacity, globalGlassBlur,
    barOpacity, barBlur, mainOpacity, mainBlur,
    dialogOpacity, dialogBlur, bgOverlayOpacity,
  } = useSettingsStore();
  const themeEffects = useSettingsStore((s) => s.themeEffects);

  useEffect(() => {
    if (theme === "default") return;
    let cancelled = false;

    const cached = readCache(theme);
    if (cached) injectTokens(cached);

    (async () => {
      try {
        const json = await invoke<string>("get_theme_css_json", {
          themeId: theme,
          userOverrides: buildUserOverrides() || null,
        });
        if (cancelled || !json) return;

        const tokens: Record<string, string> = JSON.parse(json);
        tokens["__themeId"] = theme;
        injectTokens(tokens);
        writeCache(theme, tokens);

        console.log("[Nova Theme]", {
          __primary: tokens["__primary"],
          __diag: tokens["__diag"],
          __build: tokens["__build_ts"],
          nvPrimary: tokens["--nv-color-primary"],
        });
      } catch (err) {
        console.error("[useThemeTokens] Failed:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [
    theme, themeVersion,
    paletteAccent, paletteSaturation, paletteCustomized, paletteRandomSeed, paletteRandomEnabled,
    glassMasterEnabled, globalGlassOpacity, globalGlassBlur,
    barOpacity, barBlur, mainOpacity, mainBlur,
    dialogOpacity, dialogBlur, bgOverlayOpacity,
  ]);

  // ── Per-theme effect overrides (scanline, etc.) — separate effect, reacts to themeEffects ──
  useEffect(() => {
    if (theme === "default") return;
    applyThemeEffectOverrides(theme, themeEffects[theme]);
  }, [theme, themeEffects]);
}
