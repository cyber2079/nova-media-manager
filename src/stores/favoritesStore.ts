import { create } from "zustand";
import { favorites as favDb, type FavItem as FavRow } from "@/lib/sqliteStore";

type FavItem = { id: string; type: "movie" | "image" | "music" | "game"; addedAt: string };

interface FavoritesState {
  items: Record<string, FavItem>;
  init: () => Promise<void>;
  toggleFavorite: (id: string, type: FavItem["type"]) => void;
  isFavorite: (id: string) => boolean;
  getByType: (type: FavItem["type"]) => string[];
}

function lsFallback(): Record<string, FavItem> {
  try { return JSON.parse(localStorage.getItem("app-favorites") || "{}"); } catch { return {}; }
}

function persist(items: Record<string, FavItem>) {
  localStorage.setItem("app-favorites", JSON.stringify(items));
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  items: lsFallback(),

  init: async () => {
    try {
      const rows = await favDb.getAll();
      if (rows.length > 0) {
        const items: Record<string, FavItem> = {};
        for (const r of rows) {
          items[r.itemId] = { id: r.itemId, type: r.itemType as FavItem["type"], addedAt: "" };
        }
        set({ items });
      }
    } catch {}
  },

  toggleFavorite(id: string, type: FavItem["type"]) {
    set((s) => {
      const copy = { ...s.items };
      if (copy[id]) { delete copy[id]; } else { copy[id] = { id, type, addedAt: new Date().toISOString() }; }
      persist(copy);
      // Fire-and-forget SQLite toggle
      favDb.toggle(id, type).catch(() => {});
      return { items: copy };
    });
  },

  isFavorite(id: string) { return id in get().items; },
  getByType(type: FavItem["type"]) { return Object.values(get().items).filter((i) => i.type === type).map((i) => i.id); },
}));
