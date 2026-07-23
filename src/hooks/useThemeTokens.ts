// ── Theme Token Engine — injects CSS custom properties into <head> ──
//
// Calls the Rust `get_theme_css_vars` command which:
//   1. Loads default/theme.json (embedded)
//   2. Loads active theme's theme.json from .nvtp (if not default)
//   3. Merges user overrides from SettingsStore
//   4. Flattens to :root { --nv-... } CSS block
//
// The returned CSS is injected into <style id="nv-theme-vars">.
// Additionally, we bridge --nv-* → --color-* for Tailwind compatibility
// and clear any inline style overrides left by the legacy applyPalette().

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";

/** Build a JSON string of user-customized token overrides from SettingsStore. */
function buildUserOverrides(): string {
  const s = useSettingsStore.getState();
  const overrides: Record<string, unknown> = {};

  if (s.paletteAccent) {
    overrides["colors"] = {
      primary: s.paletteAccent,
      primaryLight: s.paletteAccent,
    };
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

function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById("nv-theme-vars") as HTMLStyleElement | null;
  if (existing) return existing;
  const el = document.createElement("style");
  el.id = "nv-theme-vars";
  document.head.appendChild(el);
  return el;
}

// CSS variables that the legacy applyPalette() may have set as inline styles.
// We remove these so the token engine's stylesheet values take effect.
const LEGACY_INLINE_VARS = [
  "--color-primary", "--color-primary-light", "--color-primary-dark",
  "--color-accent",
  "--color-surface", "--color-surface-light", "--color-surface-lighter",
  "--font-primary", "--font-secondary",
  "--scroll-fade-opacity",
  "--cg-text-color", "--cg-text-bg",
];

/**
 * Load theme tokens from Rust and inject as CSS custom properties.
 * Call once in Layout — re-runs on theme switch or relevant setting changes.
 */
export function useThemeTokens() {
  const theme = useThemeStore((s) => s.theme);
  const {
    paletteAccent, paletteSaturation,
    glassMasterEnabled, globalGlassOpacity, globalGlassBlur,
    barOpacity, barBlur, mainOpacity, mainBlur,
    dialogOpacity, dialogBlur, bgOverlayOpacity,
  } = useSettingsStore();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const overrides = buildUserOverrides();
      try {
        const css = await invoke<string>("get_theme_css_vars", {
          themeId: theme,
          userOverrides: overrides || null,
        });
        if (!cancelled) {
          const el = ensureStyleElement();

          // Inject token vars + bridge to --color-* for Tailwind
          el.textContent = css + `
:root {
  --color-primary:       var(--nv-color-primary, #4788f0);
  --color-primary-light: var(--nv-color-primaryLight, #7aafff);
  --color-primary-dark:  var(--nv-color-primaryDark, #3366cc);
  --color-accent:        var(--nv-color-accent, #6366f1);
  --color-surface:       var(--nv-color-surface, color-mix(in srgb, var(--color-primary) 4%, #080c14));
  --color-surface-light:  var(--nv-color-surfaceLight, color-mix(in srgb, var(--color-primary) 6%, #101520));
  --color-surface-lighter:var(--nv-color-surfaceLighter, color-mix(in srgb, var(--color-primary) 8%, #1a1f2a));
}
`;

          // Clean up legacy inline styles that would override the token engine
          const root = document.documentElement;
          for (const v of LEGACY_INLINE_VARS) {
            root.style.removeProperty(v);
          }
        }
      } catch (err) {
        console.error("[useThemeTokens] Failed to load theme CSS:", err);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [
    theme,
    paletteAccent, paletteSaturation,
    glassMasterEnabled, globalGlassOpacity, globalGlassBlur,
    barOpacity, barBlur, mainOpacity, mainBlur,
    dialogOpacity, dialogBlur, bgOverlayOpacity,
  ]);
}
