// ── Theme Token Engine — injects CSS custom properties into <head> ──
//
// Calls the Rust `get_theme_css_vars` command which:
//   1. Loads default/theme.json (embedded)
//   2. Loads active theme's theme.json from .nvtp (if not default)
//   3. Merges user overrides from SettingsStore
//   4. Flattens to :root { --nv-... } CSS block
//
// The returned CSS is injected into <style id="nv-theme-vars">.

import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";

/** Build a JSON string of user-customized token overrides from SettingsStore. */
function buildUserOverrides(): string {
  const s = useSettingsStore.getState();
  const overrides: Record<string, unknown> = {};

  // Palette accent → colors.primary / primaryLight / primaryDark
  if (s.paletteAccent) {
    overrides["colors"] = {
      primary: s.paletteAccent,
      primaryLight: s.paletteAccent, // lightness will be adjusted client-side if needed
    };
  }

  // Glass overrides
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

  // Global overrides
  overrides["global"] = {
    bgOverlayOpacity: s.bgOverlayOpacity,
  };

  return JSON.stringify(overrides);
}

/** Ensure the <style id="nv-theme-vars"> element exists in <head>. */
function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById("nv-theme-vars") as HTMLStyleElement | null;
  if (existing) return existing;
  const el = document.createElement("style");
  el.id = "nv-theme-vars";
  document.head.appendChild(el);
  return el;
}

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

  const mountedRef = useRef(false);

  useEffect(() => {
    // Skip first render — themeStore.init() hasn't run yet
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

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
          el.textContent = css;
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
