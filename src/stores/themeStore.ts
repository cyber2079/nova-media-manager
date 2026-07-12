import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";
import { applySurface, useSettingsStore } from "./settingsStore";
import { analytics } from "@/lib/analytics";

export type ThemeName = "default" | "final-fantasy" | "overwatch" | "genshin" | "path-of-exile" | "counter-strike" | "rose" | "light" | "pretty-girl" | "black-white" | "cyber-girl";

const cycle: ThemeName[] = ["default", "final-fantasy", "overwatch", "genshin", "path-of-exile", "counter-strike", "rose", "light", "pretty-girl", "black-white", "cyber-girl"];

interface ThemeState {
  theme: ThemeName;
  init: () => Promise<void>;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
}

function resolveTheme(raw: string | null): ThemeName {
  if (raw && (cycle as string[]).includes(raw)) return raw as ThemeName;
  return "default";
}

function persist(t: ThemeName) {
  localStorage.setItem("app-theme", t); // sync fallback
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
      // Auto-apply theme's default palette if user hasn't customized
      const { paletteCustomized, resetPaletteToTheme } = useSettingsStore.getState();
      if (!paletteCustomized) resetPaletteToTheme(t);
    }
  },

  toggleTheme: () => {
    const idx = cycle.indexOf(get().theme);
    const next = cycle[(idx + 1) % cycle.length];
    get().setTheme(next);
  },
}));

document.documentElement.setAttribute("data-theme", resolveTheme(localStorage.getItem("app-theme")));
