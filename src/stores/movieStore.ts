import { create } from "zustand";
import type { Movie } from "@/types/movie";
import { invoke } from "@/lib/tauriInvoke";

interface MovieState {
  movies: Movie[];
  isLoading: boolean;
  searchQuery: string;
  activeTags: string[];
  sortConfig: string;
  isGridLayout: boolean;

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
  searchQuery: "",
  activeTags: [],
  sortConfig: "default",
  isGridLayout: true,

  loadMovies: async () => {
    set({ isLoading: true });
    try {
      const result = await invoke("get_all_movies");
      if (result) set({ movies: result as Movie[] });
    } catch {}
    set({ isLoading: false });
  },

  addMovies: async (paths: string[]) => {
    set({ isLoading: true });
    const result = await invoke("add_movies", { paths });
    if (result) {
      const newMovies = result as Movie[];
      set({ movies: [...newMovies, ...get().movies], isLoading: false });
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
    await invoke("regenerate_movie_cover", { id });
  },

  // 观看进度写库 + 本地同步（Rust 侧 ≥95% 返回 watched=true）
  updateWatchProgress: async (id: string, position: number) => {
    const watched = (await invoke("update_watch_progress", { id, position: Math.floor(position) })) as boolean;
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
