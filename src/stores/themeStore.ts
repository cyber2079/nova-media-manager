import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";
import { applySurface, useSettingsStore } from "./settingsStore";
import { analytics } from "@/lib/analytics";

export type ThemeName = "ice-girl" | "cyber-girl";

const cycle: ThemeName[] = ["ice-girl", "cyber-girl"];

interface ThemeState {
  theme: ThemeName;
  init: () => Promise<void>;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
}

function resolveTheme(raw: string | null): ThemeName {
  if (raw === "cyber-girl") return "cyber-girl";
  // path-of-exile 旧值兼容 → ice-girl
  if (raw === "path-of-exile") return "ice-girl";
  return "ice-girl";
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
    const idx = cycle.indexOf(get().theme);
    const next = cycle[(idx + 1) % cycle.length];
    get().setTheme(next);
  },
}));

document.documentElement.setAttribute("data-theme", resolveTheme(localStorage.getItem("app-theme")));
