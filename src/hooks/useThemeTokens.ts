// Theme Token Engine — inline styles on <html> (bulletproof)
//
// For non-default themes: calls Rust → gets flat JSON of --nv-* CSS vars,
// writes them + legacy --color-* bridges as inline styles with !important.
//
// For default theme: does nothing (useThemeEffects handles legacy palette).

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { themeUrl } from "@/lib/themeBase";

function buildUserOverrides(): string {
  const s = useSettingsStore.getState();
  const ov: Record<string, unknown> = {};
  if (s.paletteAccent) ov["colors"] = { primary: s.paletteAccent, primaryLight: s.paletteAccent };
  if (s.glassMasterEnabled) {
    ov["glass"] = { header:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, footer:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, main:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, dialog:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, card:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, widget:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur}, quickhub:{opacity:s.globalGlassOpacity,blur:s.globalGlassBlur} };
  } else {
    ov["glass"] = { header:{opacity:s.barOpacity,blur:s.barBlur}, footer:{opacity:s.barOpacity,blur:s.barBlur}, main:{opacity:s.mainOpacity,blur:s.mainBlur}, dialog:{opacity:s.dialogOpacity,blur:s.dialogBlur} };
  }
  ov["global"] = { bgOverlayOpacity: s.bgOverlayOpacity };
  return JSON.stringify(ov);
}

// Every --nv-color-* var → --color-* bridge needed by Tailwind & legacy code
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
    if (theme === "default") {
      // Clean up !important inline vars so useThemeEffects can take over
      const root = document.documentElement;
      for (const [, colorKey] of BRIDGE_COLORS) root.style.removeProperty(colorKey);
      document.getElementById("nv-theme-css")?.remove();
      return;
    }
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

        // Step 1: inject ALL --nv-* vars with !important priority
        for (const [key, value] of Object.entries(tokens)) {
          root.style.setProperty(key, value, "important");
        }

        // Step 2: bridge --nv-color-* → --color-* with !important
        for (const [nvKey, colorKey] of BRIDGE_COLORS) {
          const val = tokens[nvKey];
          if (val) root.style.setProperty(colorKey, val, "important");
        }

        // Step 3: load theme.css for visual effects (neon glow, animations)
        if (tokens["--nv-nav-home-icon"]) {
          let linkEl = document.getElementById("nv-theme-css") as HTMLLinkElement | null;
          if (!linkEl) {
            linkEl = document.createElement("link");
            linkEl.id = "nv-theme-css";
            linkEl.rel = "stylesheet";
            document.head.appendChild(linkEl);
          }
          linkEl.href = themeUrl(theme, "theme.css");
        } else {
          document.getElementById("nv-theme-css")?.remove();
        }

        // Step 4: confirm visually
        root.style.setProperty("--theme-loaded", theme, "important");
        console.log("%c[Nova Theme] %c" + theme + "%c loaded — primary: " + (tokens["--nv-color-primary"] || "?"),
          "color:#0f0", "color:#ff0;font-weight:bold", "color:inherit");
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
