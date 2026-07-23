import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";
import { applySurface, useSettingsStore } from "./settingsStore";
import { analytics } from "@/lib/analytics";
import { useGate } from "@/lib/useGate";
import { useLicenseStore } from "./licenseStore";
import { useThemePackStore } from "./themePackStore";

/**
 * Theme system:
 * - "default" is the built-in root theme — always available, no license required.
 * - Premium themes are installed as .nvtp packages and listed by themePackStore.
 * - This store holds the *selected* theme ID (a string).
 * - Available themes = ["default"] + installed premium themes (license-gated).
 */

export type ThemeName = string;

interface ThemeState {
  theme: ThemeName;
  init: () => Promise<void>;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
}

function persist(t: ThemeName) {
  localStorage.setItem("app-theme", t);
  document.documentElement.setAttribute("data-theme", t);
  kv.set("app-theme", t).catch(() => {});
}

function resolveTheme(raw: string | null): ThemeName {
  if (!raw) return "default";
  if (raw === "path-of-exile") return "default";
  if (raw === "ice-girl" || raw === "cyber-girl") return "default";
  return raw;
}

/** Returns the list of theme IDs the user is entitled to use.
 *  Reactively depends on license store (for gate) + installed themes. */
export function useAvailableThemes(): ThemeName[] {
  const loaded = useLicenseStore((s) => s.loaded);
  const allowed = useGate("premium-theme");
  const installed = useThemePackStore((s) => s.installedThemes);

  if (!loaded || !allowed) return ["default"];
  const ids = installed.filter(t => t.enabled).map(t => t.id);
  return ["default", ...ids];
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: resolveTheme(localStorage.getItem("app-theme")),

  init: async () => {
    const raw = await kv.get("app-theme");
    if (raw) {
      const t = resolveTheme(raw);
      set({ theme: t });
      document.documentElement.setAttribute("data-theme", t);
    }
  },

  setTheme: (t) => {
    const prev = get().theme;
    set({ theme: t }); persist(t); applySurface();
    if (prev !== t) {
      analytics.track("theme_switch", { from: prev, to: t });
      const { paletteCustomized, resetPaletteToTheme } = useSettingsStore.getState();
      if (!paletteCustomized) { resetPaletteToTheme(t); persist(t); }
    }
  },

  toggleTheme: () => {
    const { installedThemes } = useThemePackStore.getState();
    const { license } = useLicenseStore.getState();
    const ids = license.tier !== "free"
      ? ["default", ...installedThemes.filter(t => t.enabled).map(t => t.id)]
      : ["default"];
    const idx = ids.indexOf(get().theme);
    const next = ids[(idx + 1) % ids.length] || "default";
    get().setTheme(next);
  },
}));

document.documentElement.setAttribute("data-theme", resolveTheme(localStorage.getItem("app-theme")));
