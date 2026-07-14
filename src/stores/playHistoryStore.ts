import { create } from "zustand";
import { playHistory as phDb } from "@/lib/sqliteStore";

export type PlayEvent = {
  id: string; name: string; type: "movie" | "music" | "game"; time: string;
};

interface PlayHistoryState {
  history: PlayEvent[];
  recent: PlayEvent[];
  init: () => Promise<void>;
  record: (event: PlayEvent) => void;
}

const MAX = 50;

function lsFallback(): PlayEvent[] {
  try { return JSON.parse(localStorage.getItem("app-play-history") || "[]"); } catch { return []; }
}

function persist(h: PlayEvent[]) {
  localStorage.setItem("app-play-history", JSON.stringify(h));
}

export const usePlayHistoryStore = create<PlayHistoryState>((set, get) => ({
  history: lsFallback(),
  recent: lsFallback().slice(0, 12),

  init: async () => {
    try {
      const rows = await phDb.getRecent(MAX);
      if (rows.length > 0) {
        const history: PlayEvent[] = rows.map((r) => ({
          id: r.id, name: r.name,
          type: r.type as "movie" | "music" | "game",
          time: r.playedAt,
        }));
        set({ history, recent: history.slice(0, 12) });
      }
    } catch {}
  },

  record(event: PlayEvent) {
    set((s) => {
      const h = [event, ...s.history.filter((e) => e.id !== event.id)].slice(0, MAX);
      persist(h);
      // Fire-and-forget to SQLite
      phDb.add({ id: event.id, name: event.name, type: event.type, playedAt: event.time }).catch(() => {});
      return { history: h, recent: h.slice(0, 12) };
    });
  },
}));
