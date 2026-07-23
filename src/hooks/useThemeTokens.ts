// Theme Token Engine — inline style on <html> (bulletproof)
//
// Calls Rust `get_theme_css_json` which:
//   1. Loads default/theme.json (embedded)
//   2. Loads active theme's theme.json from .nvtp
//   3. Merges user overrides
//   4. Returns flat JSON: { "--nv-color-primary": "#ff005d", ... }
//
// Then writes every --nv-* value as `html.style.setProperty()`.
// Inline styles ALWAYS win over any stylesheet — no priority issues.
//
// Also bridges --nv-color-* → --color-* for Tailwind compatibility.

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";

function buildUserOverrides(): string {
  const s = useSettingsStore.getState();
  const overrides: Record<string, unknown> = {};
  if (s.paletteAccent) {
    overrides["colors"] = { primary: s.paletteAccent, primaryLight: s.paletteAccent };
  }
  if (s.glassMasterEnabled) {
    overrides["glass"] = {
      header: { opacity: s.globalGlassOpacity, blur: s.globalGlassBlur },
      footer: { opacity: s.globalGlassOpacity, blur: s.globalGlassBlur },
      main: { opacity: s.globalGlassOpacity, blur: s.globalGlassBlur },
      dialog: { opacity: s.globalGlassOpacity, blur: s.globalGlassBlur },
      card: { opacity: s.globalGlassOpacity, blur: s.globalGlassBlur },
      widget: { opacity: s.globalGlassOpacity, blur: s.globalGlassBlur },
      quickhub: { opacity: s.globalGlassOpacity, blur: s.globalGlassBlur },
    };
  } else {
    overrides["glass"] = {
      header: { opacity: s.barOpacity, blur: s.barBlur },
      footer: { opacity: s.barOpacity, blur: s.barBlur },
      main: { opacity: s.mainOpacity, blur: s.mainBlur },
      dialog: { opacity: s.dialogOpacity, blur: s.dialogBlur },
    };
  }
  overrides["global"] = { bgOverlayOpacity: s.bgOverlayOpacity };
  return JSON.stringify(overrides);
}

// Map --nv-color-* to legacy --color-* for Tailwind, --font-* for text colors
const BRIDGE_MAP: Record<string, string> = {
  "--nv-color-primary":       "--color-primary",
  "--nv-color-primaryLight":  "--color-primary-light",
  "--nv-color-primaryDark":   "--color-primary-dark",
  "--nv-color-accent":        "--color-accent",
  "--nv-color-surface":       "--color-surface",
  "--nv-color-surfaceLight":   "--color-surface-light",
  "--nv-color-surfaceLighter": "--color-surface-lighter",
  "--nv-color-text":          "--font-primary",
  "--nv-color-textSecondary": "--font-secondary",
};

const LEGACY_CLEANUP = [
  "--color-primary", "--color-primary-light", "--color-primary-dark",
  "--color-accent", "--color-surface", "--color-surface-light",
  "--color-surface-lighter", "--font-primary", "--font-secondary",
  "--scroll-fade-opacity", "--cg-text-color", "--cg-text-bg",
];

export function useThemeTokens() {
  const theme = useThemeStore((s) => s.theme);
  const themeVersion = useThemeStore((s) => s.themeVersion);
  const {
    paletteAccent, paletteSaturation,
    glassMasterEnabled, globalGlassOpacity, globalGlassBlur,
    barOpacity, barBlur, mainOpacity, mainBlur,
    dialogOpacity, dialogBlur, bgOverlayOpacity,
  } = useSettingsStore();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const json = await invoke<string>("get_theme_css_json", {
          themeId: theme,
          userOverrides: buildUserOverrides() || null,
        });
        if (cancelled || !json) return;

        const tokens: Record<string, string> = JSON.parse(json);
        const root = document.documentElement;

        // Clean legacy
        for (const v of LEGACY_CLEANUP) root.style.removeProperty(v);

        // Write ALL --nv-* vars as inline styles on <html>
        for (const [key, value] of Object.entries(tokens)) {
          root.style.setProperty(key, value);
        }

        // Bridge --nv-color-* → --color-* for Tailwind (inline too)
        for (const [nvKey, colorKey] of Object.entries(BRIDGE_MAP)) {
          const val = tokens[nvKey];
          if (val) root.style.setProperty(colorKey, val);

        }
      } catch (err) {
        console.error("[useThemeTokens] Failed:", err);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [
    theme, themeVersion,
    paletteAccent, paletteSaturation,
    glassMasterEnabled, globalGlassOpacity, globalGlassBlur,
    barOpacity, barBlur, mainOpacity, mainBlur,
    dialogOpacity, dialogBlur, bgOverlayOpacity,
  ]);
}
