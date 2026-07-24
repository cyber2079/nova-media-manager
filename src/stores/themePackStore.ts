/**
 * Theme Pack Store — manages .nvtp theme installations.
 *
 * Allows users to:
 *  - Install .nvtp files from disk
 *  - List installed theme packs
 *  - Remove theme packs
 *  - Download themes from the server
 */
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ═══════════════ TYPES ═══════════════

export interface InstalledTheme {
  id: string;
  name: string;
  author: string;
  version: string;
  requiresLicense: string; // "free" | "member" | "pro"
  preview: string;
  cssFile: string;
  installedAt: string;
  enabled: boolean;
}

export interface ThemePackInfo {
  id: string;
  name: string;
  author: string;
  version: string;
  requires_license: string;
  preview: string;
  file_size: number;
  created_at: string;
}

interface ThemePackState {
  installedThemes: InstalledTheme[];
  availableThemes: ThemePackInfo[];
  loading: boolean;

  // Actions
  refresh: () => Promise<void>;
  installFromFile: (filePath: string) => Promise<InstalledTheme>;
  installFromServer: (themeId: string) => Promise<InstalledTheme>;
  remove: (themeId: string) => Promise<void>;
  fetchAvailable: () => Promise<void>;
}

// ═══════════════ SERVER URL ═══════════════
const SERVER_URL = "https://scm-think.cn";

// ═══════════════ STORE ═══════════════

export const useThemePackStore = create<ThemePackState>((set, get) => ({
  installedThemes: [],
  availableThemes: [],
  loading: false,

  refresh: async () => {
    try {
      const themes = await invoke<InstalledTheme[]>("list_installed_themes");
      // One-off migration: "Cyberpunk" → "Cyberpunk2079"
      const migrated = themes.map(t => t.id === "cyberpunk" && t.name !== "Cyberpunk2079" ? { ...t, name: "Cyberpunk2079" } : t);
      set({ installedThemes: migrated });
    } catch (err) {
      console.warn("[themePack] list failed:", err);
    }
  },

  installFromFile: async (filePath: string) => {
    set({ loading: true });
    try {
      const theme = await invoke<InstalledTheme>("install_theme_file", { filePath });
      set((s) => ({
        installedThemes: [...s.installedThemes.filter((t) => t.id !== theme.id), theme],
        loading: false,
      }));
      return theme;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  installFromServer: async (themeId: string) => {
    set({ loading: true });
    try {
      // 1. Download .nvtp from server
      const resp = await fetch(`${SERVER_URL}/api/themes/${themeId}`);
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = new Uint8Array(await resp.arrayBuffer());

      // 2. Install from bytes via Tauri command
      const theme = await invoke<InstalledTheme>("install_theme_bytes", {
        data: Array.from(data),
      });

      set((s) => ({
        installedThemes: [...s.installedThemes.filter((t) => t.id !== theme.id), theme],
        loading: false,
      }));
      return theme;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  remove: async (themeId: string) => {
    await invoke("remove_installed_theme", { themeId });
    set((s) => ({
      installedThemes: s.installedThemes.filter((t) => t.id !== themeId),
    }));
  },

  fetchAvailable: async () => {
    try {
      const resp = await fetch(`${SERVER_URL}/api/themes/list`);
      if (resp.ok) {
        const list = await resp.json();
        set({ availableThemes: list.filter((t: { id: string }) => t.id !== "ice-girl" && t.id !== "cyber-girl") });
      }
    } catch (err) {
      console.warn("[themePack] fetchAvailable failed:", err);
    }
  },
}));
