// ── Theme Token Engine — injects CSS custom properties into <head> ──
//
// 1. Calls Rust `get_theme_css_vars` → gets `:root { --nv-*: ... }` CSS block
// 2. Injects into <style id="nv-theme-vars">
// 3. Reads computed --nv-color-* values and BRIDGES them to --color-* as
//    INLINE STYLES on <html> — this beats Tailwind v4's @theme compilation
//    and any stylesheet :root rules, guaranteed.

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";

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
  if (existing) existing.remove();
  const el = document.createElement("style");
  el.id = "nv-theme-vars";
  document.head.appendChild(el);
  return el;
}

// NV vars that need to be bridged to --color-* for Tailwind / legacy code
const NV_TO_COLOR_BRIDGE: [string, string][] = [
  ["--color-primary",       "--nv-color-primary"],
  ["--color-primary-light", "--nv-color-primaryLight"],
  ["--color-primary-dark",  "--nv-color-primaryDark"],
  ["--color-accent",        "--nv-color-accent"],
  ["--color-surface",       "--nv-color-surface"],
  ["--color-surface-light",  "--nv-color-surfaceLight"],
  ["--color-surface-lighter","--nv-color-surfaceLighter"],
  ["--font-primary",        "--nv-color-text"],
  ["--font-secondary",      "--nv-color-textSecondary"],
];

const LEGACY_INLINE_VARS = [
  "--color-primary", "--color-primary-light", "--color-primary-dark",
  "--color-accent", "--color-surface", "--color-surface-light",
  "--color-surface-lighter", "--font-primary", "--font-secondary",
  "--scroll-fade-opacity", "--cg-text-color", "--cg-text-bg",
];

/**
 * Load theme tokens from Rust, inject --nv-* vars, then bridge to --color-*
 * via inline style (highest possible CSS priority).
 */
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
        const css = await invoke<string>("get_theme_css_vars", {
          themeId: theme,
          userOverrides: buildUserOverrides() || null,
        });
        if (cancelled) return;

        // Step 1: inject --nv-* vars via <style>
        const el = ensureStyleElement();
        el.textContent = css;

        // Step 2: wait one frame for the browser to apply the stylesheet
        await new Promise(r => requestAnimationFrame(r));

        // Step 3: read computed --nv-* values and bridge to --color-* as inline style
        const root = document.documentElement;
        const computed = getComputedStyle(root);

        // Clean legacy
        for (const v of LEGACY_INLINE_VARS) {
          root.style.removeProperty(v);
        }

        // Bridge: read --nv-color-* → write --color-* inline
        for (const [colorVar, nvVar] of NV_TO_COLOR_BRIDGE) {
          const val = computed.getPropertyValue(nvVar).trim();
          if (val) {
            root.style.setProperty(colorVar, val);
          }
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
