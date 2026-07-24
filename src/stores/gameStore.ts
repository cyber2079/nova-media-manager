import { create } from "zustand";
import type { Game } from "@/types/game";
import { invoke } from "@/lib/tauriInvoke";

export type ScanResultMsg = { type: "found"; count: number } | { type: "none" } | { type: "failed"; error: string };

interface GameState {
  games: Game[];
  isLoading: boolean;
  isImporting: boolean;
  isScanning: boolean;
  scanResult: ScanResultMsg | null;
  scanDiagnostic: string[];
  sortConfig: string;
  loadGames: () => Promise<void>;
  addGame: (path: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  launchGame: (id: string) => Promise<void>;
  updateTags: (id: string, tags: string[]) => void;
  scanSteam: () => Promise<void>;
  setSortConfig: (config: string) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
  isLoading: false,
  isImporting: false,
  isScanning: false,
  scanResult: null,
  scanDiagnostic: [],
  sortConfig: "dateDesc",

  loadGames: async () => {
    set({ isLoading: true });
    try {
      const result = await invoke("get_all_games");
      if (result) set({ games: result as Game[], isLoading: false });
      else set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addGame: async (path: string) => {
    set({ isImporting: true });
    try {
      await invoke("add_game", { executablePath: path });
      // Reload full list to avoid duplicates (Rust backend returns full list, not delta)
      const all = await invoke("get_all_games");
      if (all) set({ games: all as Game[], isImporting: false });
      else set({ isImporting: false });
    } catch {
      set({ isImporting: false });
    }
  },

  deleteGame: async (id: string) => {
    try {
      const result = await invoke("delete_game", { id, raw: true });
      if (result === true) {
        set({ games: get().games.filter((g) => g.id !== id) });
      } else {
        // Fallback: reload from DB to sync state
        const all = await invoke("get_all_games", { raw: true });
        if (all) set({ games: all as Game[] });
      }
    } catch {
      // On error, reload to ensure state is correct
      try {
        const all = await invoke("get_all_games", { raw: true });
        if (all) set({ games: all as Game[] });
      } catch {}
    }
  },

  launchGame: async (id: string) => {
    await invoke("launch_game", { id });
    // Record in play history
    const g = get().games.find(g2 => g2.id === id);
    if (g) {
      const { usePlayHistoryStore } = await import("./playHistoryStore");
      usePlayHistoryStore.getState().record({
        id: g.id, name: g.name, type: "game",
        time: new Date().toISOString(),
      });
    }
  },

  updateTags: (id: string, tags: string[]) => {
    invoke("update_game_tags", { id, tags });
    set({ games: get().games.map((g) => (g.id === id ? { ...g, tags } : g)) });
  },

  scanSteam: async () => {
    set({ isScanning: true, scanResult: null, scanDiagnostic: [] });
    try {
      const result = await invoke("scan_steam_games") as { newGames: Game[]; diagnostic: string[] };
      set({ scanDiagnostic: result.diagnostic || [] });
      if (result.newGames && result.newGames.length > 0) {
        const count = result.newGames.length;
        set({
          games: [...result.newGames, ...get().games],
          isScanning: false,
          scanResult: { type: "found", count },
        });
      } else {
        set({ isScanning: false, scanResult: { type: "none" } });
      }
    } catch (e) {
      set({ isScanning: false, scanResult: { type: "failed", error: String(e) }, scanDiagnostic: [] });
    }
  },
  setSortConfig: (config: string) => set({ sortConfig: config }),
}));
