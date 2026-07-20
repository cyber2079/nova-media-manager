// ── Theme CSS-variable effects ──
// bundles theme color injection, font/icon scaling, font family, and font color
// so Layout.tsx stays focused on layout rather than CSS plumbing.

import { useEffect } from "react";
import { useSettingsStore, computeThemeColors, fontSizeScale, iconSizeScale, applySurface, applyFontFamily, applyFontColors } from "@/stores/settingsStore";

/** Apply theme color + font + icon cascading effects. Call once near the top of Layout. */
export function useThemeEffects() {
  // ── Custom theme color injection ──
  useEffect(() => {
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
      if (s.useCustomColor !== prev.useCustomColor || s.customColor !== prev.customColor) apply();
    });
  }, []);

  // ── Font + icon size ──
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

  // ── Font family ──
  useEffect(() => {
    applyFontFamily();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.fontFamily !== prev.fontFamily) applyFontFamily(s.fontFamily);
    });
  }, []);

  // ── Font colors ──
  useEffect(() => {
    applyFontColors();
    return useSettingsStore.subscribe((s, prev) => {
      if (s.fontPrimaryColor !== prev.fontPrimaryColor || s.fontSecondaryColor !== prev.fontSecondaryColor
        || s.widgetTextColor !== prev.widgetTextColor) applyFontColors();
    });
  }, []);
}
