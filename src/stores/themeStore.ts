import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";
import { applySurface, useSettingsStore } from "./settingsStore";
import { analytics } from "@/lib/analytics";

/**
 * Theme system:
 * - "default" is the only built-in theme — always available, no license required.
 * - Premium themes (ice-girl, cyber-girl, …) are downloaded as .nvtp packages
 *   from the server and only available to Pro+ subscribers.
 * - This store holds the *selected* theme; premium themes listed here are
 *   resolved at runtime via the license gate in useAvailableThemes().
 */
export type ThemeName = "default" | "ice-girl" | "cyber-girl";

/** All known theme IDs. Only "default" is guaranteed; others require license + download. */
const allThemes: ThemeName[] = ["default", "ice-girl", "cyber-girl"];

interface ThemeState {
  theme: ThemeName;
  init: () => Promise<void>;
  setTheme: (t: ThemeName) => void;
  /** Cycle through themes the user is entitled to use */
  toggleTheme: () => void;
}

function resolveTheme(raw: string | null): ThemeName {
  if (!raw) return "default";
  // legacy migration
  if (raw === "path-of-exile") return "ice-girl";
  if ((allThemes as string[]).includes(raw)) return raw as ThemeName;
  return "default";
}

function persist(t: ThemeName) {
  localStorage.setItem("app-theme", t);
  document.documentElement.setAttribute("data-theme", t);
  kv.set("app-theme", t).catch(() => {});
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
    const idx = allThemes.indexOf(get().theme);
    const next = allThemes[(idx + 1) % allThemes.length];
    get().setTheme(next);
  },
}));

document.documentElement.setAttribute("data-theme", resolveTheme(localStorage.getItem("app-theme")));
