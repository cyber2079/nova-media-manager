import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";
import { applySurface, useSettingsStore } from "./settingsStore";
import { analytics } from "@/lib/analytics";
import { useGate } from "@/lib/useGate";
import { useLicenseStore } from "./licenseStore";

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

/** Premium theme IDs (everything except default). */
const premiumThemes: ThemeName[] = ["ice-girl", "cyber-girl"];

/**
 * Returns the list of themes the user is entitled to use.
 * Free tier sees only ["default"]. Pro+ sees default + all premium.
 * Reactive — re-renders when license store changes.
 *
 * During init (license not yet loaded from DB), returns ["default"]
 * to avoid a flash of premium themes on a free user's screen.
 * The hook re-renders automatically once licenseStore.loaded = true.
 */
export function useAvailableThemes(): ThemeName[] {
  const loaded = useLicenseStore((s) => s.loaded);
  const allowed = useGate("premium-theme");
  // Wait for license to load before granting premium access
  if (!loaded || !allowed) return ["default"];
  return allThemes;
}

interface ThemeState {
  theme: ThemeName;
  init: () => Promise<void>;
  setTheme: (t: ThemeName) => void;
  /** Cycle through themes the user is entitled to use */
  toggleTheme: () => void;
}

/** Check if a theme is allowed for the current license tier. */
function isThemeAllowed(t: ThemeName): boolean {
  if (t === "default") return true;
  const license = useLicenseStore.getState().license;
  return license.tier !== "free";
}

function resolveTheme(raw: string | null): ThemeName {
  if (!raw) return "default";
  if (raw === "path-of-exile") return "ice-girl";
  if (!(allThemes as string[]).includes(raw)) return "default";
  const theme = raw as ThemeName;
  if (!isThemeAllowed(theme)) return "default";
  return theme;
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
    const tier = useLicenseStore.getState().license.tier;
    const available = tier === "free" ? ["default" as ThemeName] : allThemes;
    const idx = available.indexOf(get().theme);
    const next = available[(idx + 1) % available.length];
    get().setTheme(next);
  },
}));

document.documentElement.setAttribute("data-theme", resolveTheme(localStorage.getItem("app-theme")));
