import { create } from "zustand";
import type { Music } from "@/types/music";
import { invoke } from "@/lib/tauriInvoke";

interface MusicState {
  music: Music[];
  isLoading: boolean;
  activeTags: string[];
  searchQuery: string;
  sortConfig: string;

  loadMusic: () => Promise<void>;
  addMusic: (paths: string[]) => Promise<void>;
  deleteMusic: (id: string) => Promise<void>;
  updateTags: (id: string, tags: string[]) => Promise<void>;
  setSearchQuery: (q: string) => void;
  toggleTag: (tag: string) => void;
  setActiveTags: (tags: string[]) => void;
  setSortConfig: (config: string) => void;
}

export const useMusicStore = create<MusicState>((set, get) => ({
  music: [],
  isLoading: false,
  activeTags: [],
  searchQuery: "",
  sortConfig: "default",

  loadMusic: async () => {
    set({ isLoading: true });
    try {
      const data = await invoke("get_all_music");
      if (data) set({ music: data as Music[] });
    } catch {
      // SQLite via Tauri is the only store now — no localStorage fallback
    }
    set({ isLoading: false });
  },

  addMusic: async (paths: string[]) => {
    const data = await invoke("add_music", { filePaths: paths });
    if (data) {
      set({ music: [...get().music, ...(data as Music[])] });
    }
  },

  deleteMusic: async (id: string) => {
    await invoke("delete_music", { id });
    set({ music: get().music.filter((m) => m.id !== id) });
  },

  updateTags: async (id: string, tags: string[]) => {
    await invoke("update_music_tags", { id, tags });
    set({ music: get().music.map((m) => (m.id === id ? { ...m, tags } : m)) });
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),
  toggleTag: (tag: string) => {
    const { activeTags } = get();
    set({ activeTags: activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag] });
  },
  setActiveTags: (tags: string[]) => set({ activeTags: tags }),
  setSortConfig: (config: string) => set({ sortConfig: config }),
}));
