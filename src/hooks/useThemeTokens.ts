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
import { useSettingsStore } from "@/stores/settingsStore";
import { themeUrl } from "@/lib/themeBase";

const CACHE_KEY = "nv-theme-tokens-v2";

function buildUserOverrides(): string {
  const s = useSettingsStore.getState();
  const ov: Record<string, unknown> = {};
  // Palette override: if user customized palette, send their chosen accent as primary color
  if (s.paletteCustomized && s.paletteAccent) ov["colors"] = { primary: s.paletteAccent, primaryLight: s.paletteAccent };
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

function cleanupInline() {
  const root = document.documentElement;
  for (const [, colorKey] of BRIDGE_COLORS) root.style.removeProperty(colorKey);
  document.getElementById("nv-theme-css")?.remove();
  document.getElementById("nv-neon-icons")?.remove();
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

  useEffect(() => {
    if (theme === "default") { cleanupInline(); return; }
    let cancelled = false;

    // Sync apply from cache (no flash on startup)
    const cached = readCache(theme);
    if (cached) injectTokens(cached);

    // Async fetch fresh tokens from Rust, then update
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

        // Diagnostic
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
}
