import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeName } from "./themeStore";
import { kv } from "@/lib/sqliteStore";

const SQLITE_KEY = "app-theme-shortcuts";

// ── Types ──

export interface DefaultChar {
  id: string;
  name: string;
  fileName: string;
  subtitle: string;
  color: string;
}

export interface CharOverride {
  name?: string;
  subtitle?: string;
  customIconPath?: string; // local filesystem path or empty
  appPath?: string;        // local filesystem path or empty
}

export interface ThemeCharacter {
  id: string;
  name: string;
  fileName: string;
  subtitle: string;
  iconPath: string;   // resolved src (default theme URL or custom local path)
  appPath: string;
  color: string;
  isCustom: boolean;
}

// ── Default character data (extracted from Home.tsx) ──

const themeBases: Record<ThemeName, string> = {
  default: "",
  "final-fantasy": "/themes/final%20fantasy",
  overwatch: "/themes/over%20watch",
  genshin: "/themes/Genshin%20impact",
  "path-of-exile": "/themes/path of exile",
  "counter-strike": "/themes/cs2",
  "pretty-girl": "/themes/pretty%20girl",
  "black-white": "/themes/black%20withe",
  "cyber-girl": "/themes/cyber%20girl",
  rose: "",
  light: "",
};

const DEFAULT_CHARACTERS: Record<ThemeName, DefaultChar[]> = {
  default: [],
  "final-fantasy": [
    { id: "ff7_cloud",     name: "Cloud",     fileName: "cloud.webp",    subtitle: "元SOLDIER", color: "#4488ff" },
    { id: "ff7_tifa",      name: "Tifa",      fileName: "tifa.webp",     subtitle: "格闘家",    color: "#ff88cc" },
    { id: "ff7_aerith",    name: "Aerith",    fileName: "aerith.webp",   subtitle: "古代種",    color: "#88ccff" },
    { id: "ff7_sephiroth", name: "Sephiroth", fileName: "sephiroth.webp", subtitle: "英雄",      color: "#00e5a0" },
    { id: "ff7_barret",    name: "Barret",    fileName: "barret.webp",   subtitle: "AVALANCHE", color: "#e6b422" },
    { id: "ff7_vincent",   name: "Vincent",   fileName: "vincent.webp",  subtitle: "銃使い",    color: "#cc3333" },
  ],
  overwatch: [
    { id: "ow_tracer", name: "Tracer", fileName: "PI_Cute_Tracer.webp", subtitle: "DPS",     color: "#f99e1a" },
    { id: "ow_dva",    name: "D.Va",   fileName: "PI_Cute_D.Va.webp",   subtitle: "Tank",    color: "#f99e1a" },
    { id: "ow_genji",  name: "Genji",  fileName: "PI_Cute_Genji.webp",  subtitle: "DPS",     color: "#218ffe" },
    { id: "ow_mercy",  name: "Mercy",  fileName: "PI_Cute_Mercy.webp",  subtitle: "Support", color: "#218ffe" },
    { id: "ow_sombra", name: "Sombra", fileName: "PI_Cute_Sombra.webp", subtitle: "DPS",     color: "#f99e1a" },
    { id: "ow_reaper", name: "Reaper", fileName: "PI_Cute_Reaper.webp", subtitle: "DPS",     color: "#218ffe" },
    { id: "ow_mei",    name: "Mei",    fileName: "PI_Cute_Mei.webp",    subtitle: "DPS",     color: "#f99e1a" },
    { id: "ow_lucio",  name: "Lucio",  fileName: "PI_Cute_Lucio.webp",  subtitle: "Support", color: "#218ffe" },
  ],
  genshin: [
    { id: "gi_venti",   name: "Venti",   fileName: "8a0eeaff67d95dd467335fd3c9a2cd38_5743503445605614962.webp", subtitle: "Anemo",   color: "#5b8c5a" },
    { id: "gi_diluc",   name: "Diluc",   fileName: "bcbd2761b4a6d3cef8030190c8f223f1_4271792812021254758.webp", subtitle: "Pyro",    color: "#e06040" },
    { id: "gi_ganyu",   name: "Ganyu",   fileName: "c096289444775cca45d9a582c2251751_2269727048272096048.webp", subtitle: "Cryo",    color: "#87ceeb" },
    { id: "gi_zhongli", name: "Zhongli", fileName: "7b47aa8ac8e2a35ae5e7d37d264dcb93_8832500935181332478.webp", subtitle: "Geo",     color: "#d4a84b" },
    { id: "gi_xiao",    name: "Xiao",    fileName: "2021072011085576262.webp",                               subtitle: "Yaksha",  color: "#5b8c5a" },
    { id: "gi_raiden",  name: "Raiden",  fileName: "2022012718344593599.webp",                               subtitle: "Electro", color: "#b39ddb" },
    { id: "gi_ayaka",   name: "Ayaka",   fileName: "2022012718350213870.webp",                               subtitle: "Cryo",    color: "#87ceeb" },
    { id: "gi_keqing",  name: "Keqing",  fileName: "dcad345594a9d67859cc361c9094451f_3515168789574444713.webp", subtitle: "Yuheng",  color: "#d4a84b" },
  ],
  "path-of-exile": [
    { id: "poe_icestorm",     name: "home.poe_icestorm_name",     fileName: "1.webp", subtitle: "home.poe_icestorm_subtitle",     color: "#87ceeb" },
    { id: "poe_arcticarmour", name: "home.poe_arcticarmour_name", fileName: "2.webp", subtitle: "home.poe_arcticarmour_subtitle", color: "#b0e0e6" },
    { id: "poe_frostwall",    name: "home.poe_frostwall_name",    fileName: "3.webp", subtitle: "home.poe_frostwall_subtitle",    color: "#00bfff" },
    { id: "poe_icenova",      name: "home.poe_icenova_name",      fileName: "4.webp", subtitle: "home.poe_icenova_subtitle",      color: "#4488ff" },
    { id: "poe_comet",        name: "home.poe_comet_name",        fileName: "5.webp", subtitle: "home.poe_comet_subtitle",        color: "#6a5acd" },
    { id: "poe_eyeofwinter",  name: "home.poe_eyeofwinter_name",  fileName: "6.webp", subtitle: "home.poe_eyeofwinter_subtitle",  color: "#4169e1" },
  ],
  "counter-strike": [
    { id: "cs2_sas",        name: "SAS",         fileName: "crosshair.svg", subtitle: "Counter-Terrorist", color: "#4a90d9" },
    { id: "cs2_phoenix",    name: "Phoenix",     fileName: "ak47.svg",      subtitle: "Terrorist",        color: "#de6d1c" },
    { id: "cs2_fbi",        name: "FBI HRT",     fileName: "awp.svg",       subtitle: "Counter-Terrorist", color: "#4a90d9" },
    { id: "cs2_elite",      name: "Elite Crew",  fileName: "bomb.svg",      subtitle: "Terrorist",        color: "#cc4444" },
    { id: "cs2_gign",       name: "GIGN",        fileName: "shield.svg",    subtitle: "Counter-Terrorist", color: "#4a90d9" },
    { id: "cs2_separatist", name: "Separatist",  fileName: "skull.svg",     subtitle: "Terrorist",        color: "#de6d1c" },
  ],
  "pretty-girl": [
    { id: "pg_dance", name: "home.pg_dance_name", fileName: "dance.webp", subtitle: "home.pg_dance_subtitle", color: "#ff69b4" },
    { id: "pg_fly",   name: "home.pg_fly_name",   fileName: "fly.webp",   subtitle: "home.pg_fly_subtitle",   color: "#da70d6" },
    { id: "pg_heart", name: "home.pg_heart_name", fileName: "heart.webp", subtitle: "home.pg_heart_subtitle", color: "#ff1493" },
    { id: "pg_arrow", name: "home.pg_arrow_name", fileName: "arrow.webp", subtitle: "home.pg_arrow_subtitle", color: "#c71585" },
    { id: "pg_pray",  name: "home.pg_pray_name",  fileName: "pray.webp",  subtitle: "home.pg_pray_subtitle",  color: "#db7093" },
  ],
  "black-white": [
    { id: "bw_bag",         name: "home.bw_bag_name",         fileName: "bag.webp",         subtitle: "home.bw_bag_subtitle",         color: "#c8a882" },
    { id: "bw_shoe",        name: "home.bw_shoe_name",        fileName: "shoe.webp",        subtitle: "home.bw_shoe_subtitle",        color: "#b8b8c0" },
    { id: "bw_lips",        name: "home.bw_lips_name",        fileName: "lips.webp",        subtitle: "home.bw_lips_subtitle",        color: "#cc6678" },
    { id: "bw_water",       name: "home.bw_water_name",       fileName: "water.webp",       subtitle: "home.bw_water_subtitle",       color: "#90b8c8" },
    { id: "bw_lingzi",      name: "home.bw_lingzi_name",      fileName: "lingzi.webp",      subtitle: "home.bw_lingzi_subtitle",      color: "#c8b090" },
    { id: "bw_perfume",     name: "home.bw_perfume_name",     fileName: "jimeng-2026-07-08-5287-黑色逆光剪影风格，香水主题图标，透明背景，正方形，简约高级，适合作为APP图标，....webp", subtitle: "home.bw_perfume_subtitle", color: "#d0c0d0" },
    { id: "bw_silhouette",  name: "home.bw_silhouette_name",  fileName: "jimeng-2026-07-08-6411-黑色逆光女性剪影风格，电影主题图标，透明背景，正方形，简约高级，适合作为APP图....webp", subtitle: "home.bw_silhouette_subtitle", color: "#a0a0b0" },
  ],
  "cyber-girl": [
    { id: "cg_skill1", name: "home.cg_skill1_name", fileName: "skill1.webp", subtitle: "home.cg_skill1_subtitle", color: "#ff69b4" },
    { id: "cg_skill2", name: "home.cg_skill2_name", fileName: "skill2.webp", subtitle: "home.cg_skill2_subtitle", color: "#da70d6" },
    { id: "cg_skill3", name: "home.cg_skill3_name", fileName: "skill3.webp", subtitle: "home.cg_skill3_subtitle", color: "#ff1493" },
    { id: "cg_skill4", name: "home.cg_skill4_name", fileName: "skill4.webp", subtitle: "home.cg_skill4_subtitle", color: "#00bfff" },
    { id: "cg_skill5", name: "home.cg_skill5_name", fileName: "skill5.webp", subtitle: "home.cg_skill5_subtitle", color: "#9400d3" },
    { id: "cg_skill6", name: "home.cg_skill6_name", fileName: "skill6.webp", subtitle: "home.cg_skill6_subtitle", color: "#ff6347" },
  ],
  rose: [],
  light: [],
};

// ── Helpers ──

function resolveIconPath(
  theme: ThemeName,
  fileName: string,
  customIconPath: string | undefined
): string {
  if (customIconPath && customIconPath.length > 0) {
    return customIconPath;
  }
  return `${themeBases[theme] || ""}/icons/${fileName}`;
}

// ── Store ──

interface ThemeShortcutState {
  overrides: Record<string, CharOverride>;

  init: () => Promise<void>;
  getCharacters: (theme: ThemeName) => ThemeCharacter[];
  saveOverride: (id: string, override: CharOverride) => void;
  resetCharacter: (id: string) => void;
  hasOverrides: (id: string) => boolean;
}

// Fire-and-forget sync to SQLite (no await, not blocking)
function syncToSqlite(overrides: Record<string, CharOverride>) {
  kv.set(SQLITE_KEY, JSON.stringify(overrides)).catch(() => {});
}

export const useThemeShortcutStore = create<ThemeShortcutState>()(
  persist(
    (set, get) => ({
      overrides: {},

      init: async () => {
        try {
          const raw = await kv.get(SQLITE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              set({ overrides: parsed as Record<string, CharOverride> });
            }
          }
        } catch {}
      },

      getCharacters(theme: ThemeName): ThemeCharacter[] {
        const defaults = DEFAULT_CHARACTERS[theme] || [];
        const { overrides } = get();

        return defaults.map((d) => {
          const ov = overrides[d.id];
          const name = ov?.name ?? d.name;
          const subtitle = ov?.subtitle ?? d.subtitle;
          const appPath = ov?.appPath ?? "";
          const iconPath = resolveIconPath(theme, d.fileName, ov?.customIconPath);
          const isCustom = !!ov && Object.keys(ov).length > 0;

          return {
            id: d.id,
            name,
            fileName: d.fileName,
            subtitle,
            iconPath,
            appPath,
            color: d.color,
            isCustom,
          };
        });
      },

      saveOverride(id: string, override: CharOverride) {
        // Keep overrides clean: skip undefined, but keep empty strings (user explicitly cleared)
        const cleaned: CharOverride = {};
        if (override.name !== undefined) { cleaned.name = override.name; }
        if (override.subtitle !== undefined) { cleaned.subtitle = override.subtitle; }
        if (override.customIconPath !== undefined) { cleaned.customIconPath = override.customIconPath; }
        if (override.appPath !== undefined) { cleaned.appPath = override.appPath; }

        set((s) => {
          const next = { ...s.overrides, [id]: cleaned };
          syncToSqlite(next);
          return { overrides: next };
        });
      },

      resetCharacter(id: string) {
        set((s) => {
          const copy = { ...s.overrides };
          delete copy[id];
          syncToSqlite(copy);
          return { overrides: copy };
        });
      },

      hasOverrides(id: string): boolean {
        return id in get().overrides;
      },
    }),
    {
      name: "theme-shortcut-overrides",
      // Only persist the overrides map
      partialize: (state) => ({ overrides: state.overrides }),
    }
  )
);

// ── Standalone helpers (Tauri APIs, call from components) ──

export async function pickAppFile(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      title: "选择应用程序",
    });
    if (selected) {
      // Strip Zone.Identifier ADS to prevent SmartScreen prompts
      try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("unblock_file", { path: selected as string }); } catch {}
    }
    return selected as string | null;
  } catch {
    return null;
  }
}

export async function pickIconFile(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      title: "选择图标",
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "ico", "svg", "bmp"] }],
    });
    if (selected) {
      try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("unblock_file", { path: selected as string }); } catch {}
    }
    return selected as string | null;
  } catch {
    return null;
  }
}

export async function launchApp(path: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("launch_quick_item", { programPath: path });
  } catch {
    // fallback
  }
}
