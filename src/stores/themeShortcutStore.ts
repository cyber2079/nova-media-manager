import { create } from "zustand";
import { persist } from "zustand/middleware";
// ThemeName is now `string` — no type import needed
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

import { themeUrl } from "@/lib/themeBase";

const DEFAULT_CHARACTERS: Record<string, DefaultChar[]> = {
  default: [],
};

// ── Helpers ──

function resolveIconPath(
  theme: string,
  fileName: string,
  customIconPath: string | undefined
): string {
  if (customIconPath && customIconPath.length > 0) return customIconPath;
  if (theme === "default") return "";
  return themeUrl(theme, `icons/${fileName}`);
}

// ── Store ──

interface ThemeShortcutState {
  overrides: Record<string, CharOverride>;

  init: () => Promise<void>;
  getCharacters: (theme: string) => ThemeCharacter[];
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

      getCharacters(theme: string): ThemeCharacter[] {
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
