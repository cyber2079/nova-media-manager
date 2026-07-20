import { create } from "zustand";
import { invoke } from "@/lib/tauriInvoke";

export interface QuickLaunchItem {
  id: string;
  name: string;
  programPath: string;
  iconPath: string;
  sortOrder: number;
  args: string;
}

interface QLState {
  items: QuickLaunchItem[];
  load: () => Promise<void>;
  add: (path: string, args?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  launch: (path: string, args?: string) => Promise<void>;
}

export const useQuickLaunchStore = create<QLState>((set, get) => ({
  items: [],

  load: async () => {
    const result = await invoke("get_quick_launch");
    if (result) set({ items: result as QuickLaunchItem[] });
  },

  add: async (path: string, args?: string) => {
    const item = await invoke("add_quick_launch", { programPath: path, args: args || "" });
    if (item) {
      const updated = [...get().items, item as QuickLaunchItem];
      set({ items: updated });
    }
  },

  remove: async (id: string) => {
    await invoke("remove_quick_launch", { id });
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  launch: async (path: string, args?: string) => {
    await invoke("launch_quick_item", { programPath: path, args: args || "" });
  },
}));
