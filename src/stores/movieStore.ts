import { create } from "zustand";
import type { Movie } from "@/types/movie";
import { invoke } from "@/lib/tauriInvoke";
import { isPaid, useLicenseStore } from "@/stores/licenseStore";

interface MovieState {
  movies: Movie[];
  isLoading: boolean;
  isImporting: boolean;
  searchQuery: string;
  activeTags: string[];
  sortConfig: string;
  isGridLayout: boolean;
  _watchSeq: number; // internal — discards stale concurrent watch-progress writes

  loadMovies: () => Promise<void>;
  addMovies: (paths: string[]) => Promise<void>;
  deleteMovie: (id: string) => Promise<void>;
  updateMovie: (movie: Movie) => void;
  regenerateCover: (id: string) => Promise<void>;
  updateWatchProgress: (id: string, position: number) => Promise<void>;
  setSearchQuery: (q: string) => void;
  toggleTag: (tag: string) => void;
  updateMovieTags: (id: string, tags: string[]) => void;
  setSortConfig: (config: string) => void;
  toggleLayout: () => void;
}

export const useMovieStore = create<MovieState>((set, get) => ({
  movies: [],
  isLoading: false,
  isImporting: false,
  searchQuery: "",
  activeTags: [],
  sortConfig: "default",
  isGridLayout: true,
  _watchSeq: 0,

  loadMovies: async () => {
    set({ isLoading: true });
    try {
      const result = await invoke("get_all_movies");
      if (result) set({ movies: result as Movie[] });
    } catch {}
    set({ isLoading: false });
  },

  addMovies: async (paths: string[]) => {
    set({ isImporting: true });
    try {
      const result = await invoke("add_movies", { paths });
      if (result) {
        const newMovies = result as Movie[];
        set({ movies: [...newMovies, ...get().movies], isImporting: false });
      } else {
        set({ isImporting: false });
      }
    } catch {
      set({ isImporting: false });
    }
  },

  deleteMovie: async (id: string) => {
    await invoke("delete_movie", { id });
    set({ movies: get().movies.filter((m) => m.id !== id) });
  },

  updateMovie: (movie: Movie) => {
    set({ movies: get().movies.map((m) => (m.id === movie.id ? movie : m)) });
  },

  // 状态推进（processing → ready）经 movie-updated 事件回流，不在此更新
  regenerateCover: async (id: string) => {
    // 会员专享：自动截取视频帧生成封面
    if (!isPaid(useLicenseStore.getState().license.tier)) return;
    await invoke("regenerate_movie_cover", { id });
  },

  // 观看进度写库 + 本地同步（Rust 侧 ≥95% 返回 watched=true）
  // Uses _watchSeq to discard stale concurrent writes (e.g. rapid onTimeUpdate + force save on close)
  updateWatchProgress: async (id: string, position: number) => {
    const seq = ++get()._watchSeq;
    const raw = await invoke("update_watch_progress", { id, position: Math.floor(position) });
    const watched = raw === true; // cast safely — null/undefined → false, true → true
    // Discard if a newer write has already been issued
    if (seq !== get()._watchSeq) return;
    set({
      movies: get().movies.map((m) => (m.id === id
        ? { ...m, watchPosition: Math.floor(position), watchUpdatedAt: new Date().toISOString(), watched }
        : m)),
    });
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),

  toggleTag: (tag: string) => {
    const tags = get().activeTags;
    set({ activeTags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] });
  },

  updateMovieTags: (id: string, tags: string[]) => {
    invoke("update_movie_tags", { id, tags });
    set({ movies: get().movies.map((m) => (m.id === id ? { ...m, tags } : m)) });
  },

  setSortConfig: (config: string) => set({ sortConfig: config }),
  toggleLayout: () => set({ isGridLayout: !get().isGridLayout }),
}));
