// Theme CSS-variable effects — legacy palette system for default theme ONLY.
// Non-default themes use the Token Engine (useThemeTokens) which injects
// --nv-* vars + bridges them to --color-* via inline styles on <html>.

import { useEffect } from "react";
import { useSettingsStore, computeThemeColors, fontSizeScale, iconSizeScale, applySurface, applyFontFamily, applyFontColors } from "@/stores/settingsStore";
import { useThemeStore } from "@/stores/themeStore";

export function useThemeEffects() {
  const theme = useThemeStore((s) => s.theme);
  const isDefault = theme === "default";

  // ── Palette (default theme only — token engine handles non-default) ──
  useEffect(() => {
    if (!isDefault) return; // Token engine owns --color-* for non-default themes

    const apply = () => {
      const { useCustomColor, customColor } = useSettingsStore.getState();
      const el = document.documentElement;
      if (useCustomColor) {
        const c = computeThemeColors(customColor);
        el.style.setProperty("--color-primary", c.primary);
        el.style.setProperty("--color-primary-light", c.light);
        el.style.setProperty("--color-primary-dark", c.dark);
        el.setAttribute("data-custom-theme", "true");
      } else {
        ["primary","primary-light","primary-dark"].forEach(k => el.style.removeProperty("--color-" + k));
        el.removeAttribute("data-custom-theme");
      }
      applySurface();
    };
    apply();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.useCustomColor !== prev.useCustomColor || s.customColor !== prev.customColor
        || s.paletteAccent !== prev.paletteAccent) apply();
    });
  }, [isDefault]);

  // ── Font + icon size (all themes) ──
  useEffect(() => {
    const apply = () => {
      const { fontSize, iconSize } = useSettingsStore.getState();
      document.documentElement.style.setProperty("--app-font-scale", String(fontSizeScale(fontSize)));
      document.documentElement.style.setProperty("--app-icon-scale", String(iconSizeScale(iconSize)));
    };
    apply();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.fontSize !== prev.fontSize || s.iconSize !== prev.iconSize) apply();
    });
  }, []);

  // ── Font family (all themes) ──
  useEffect(() => {
    applyFontFamily();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.fontFamily !== prev.fontFamily) applyFontFamily(s.fontFamily);
    });
  }, []);

  // ── Font colors (all themes) ──
  useEffect(() => {
    applyFontColors();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.fontPrimaryColor !== prev.fontPrimaryColor || s.fontSecondaryColor !== prev.fontSecondaryColor
        || s.widgetTextColor !== prev.widgetTextColor) applyFontColors();
    });
  }, []);
}
