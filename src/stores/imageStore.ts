import { create } from "zustand";
import type { ImageItem } from "@/types/image";
import { invoke } from "@/lib/tauriInvoke";

interface ImageState {
  images: ImageItem[];
  isLoading: boolean;
  isImporting: boolean;
  sortConfig: string;
  loadImages: () => Promise<void>;
  addImages: (paths: string[]) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  updateTags: (id: string, tags: string[]) => void;
  setSortConfig: (config: string) => void;
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: [],
  isLoading: false,
  isImporting: false,
  sortConfig: "default",

  loadImages: async () => {
    set({ isLoading: true });
    try {
      const result = await invoke("get_all_images");
      if (result) set({ images: result as ImageItem[] });
    } catch {
      // Tauri通信失败——保持现有数据，避免永久loading
    }
    set({ isLoading: false });
  },

  addImages: async (paths: string[]) => {
    set({ isImporting: true });
    try {
      const result = await invoke("add_images", { paths });
      if (result) {
        set({ images: [...(result as ImageItem[]), ...get().images], isImporting: false });
      } else {
        set({ isImporting: false });
      }
    } catch {
      set({ isImporting: false });
    }
  },

  deleteImage: async (id: string) => {
    await invoke("delete_image", { id });
    set({ images: get().images.filter((i) => i.id !== id) });
  },

  updateTags: (id: string, tags: string[]) => {
    invoke("update_image_tags", { id, tags });
    set({ images: get().images.map((i) => (i.id === id ? { ...i, tags } : i)) });
  },
  setSortConfig: (config: string) => set({ sortConfig: config }),
}));
