import { create } from "zustand";
import { playlists as plDb, type PlaylistRow } from "@/lib/sqliteStore";

export type PlayMode = "sequential" | "repeat-one" | "repeat-all" | "shuffle";

export interface Playlist {
  id: string;
  name: string;
  musicIds: string[];
  createdAt: string;
}

interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  playMode: PlayMode;

  init: () => Promise<void>;
  create: (name: string) => Playlist;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  addSong: (playlistId: string, musicId: string) => void;
  addSongs: (playlistId: string, musicIds: string[]) => void;
  removeSong: (playlistId: string, musicId: string) => void;
  removeSongs: (playlistId: string, musicIds: string[]) => void;
  setActive: (id: string | null) => void;
  setPlayMode: (mode: PlayMode) => void;
  getNextSong: (currentIndex: number, playlistMusicIds: string[]) => { id: string; index: number };
}

function fromRow(r: PlaylistRow): Playlist {
  let ids: string[] = [];
  try { ids = JSON.parse(r.musicIds); } catch {}
  return { id: r.id, name: r.name, musicIds: ids, createdAt: r.createdAt };
}

function toRow(p: Playlist): PlaylistRow {
  return { id: p.id, name: p.name, musicIds: JSON.stringify(p.musicIds), createdAt: p.createdAt };
}

function lsFallback(): Playlist[] {
  try { return JSON.parse(localStorage.getItem("app-playlists") || "[]"); } catch { return []; }
}

async function persist(pls: Playlist[]) {
  localStorage.setItem("app-playlists", JSON.stringify(pls));
  const rows = pls.map(toRow);
  await plDb.saveAll(rows).catch(() => {});
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: lsFallback(),
  activePlaylistId: null,
  playMode: "sequential",

  init: async () => {
    try {
      const rows = await plDb.getAll();
      if (rows.length > 0) {
        set({ playlists: rows.map(fromRow) });
      }
    } catch {}
  },

  create(name: string) {
    const p: Playlist = { id: crypto.randomUUID(), name, musicIds: [], createdAt: new Date().toISOString() };
    const next = [...get().playlists, p];
    set({ playlists: next });
    persist(next);
    return p;
  },

  rename(id: string, name: string) {
    const next = get().playlists.map((p) => p.id === id ? { ...p, name } : p);
    set({ playlists: next });
    persist(next);
  },

  remove(id: string) {
    const next = get().playlists.filter((p) => p.id !== id);
    set({ playlists: next, activePlaylistId: get().activePlaylistId === id ? null : get().activePlaylistId });
    persist(next);
    plDb.delete(id).catch(() => {});
  },

  addSong(playlistId, musicId) {
    const next = get().playlists.map((p) =>
      p.id === playlistId && !p.musicIds.includes(musicId) ? { ...p, musicIds: [...p.musicIds, musicId] } : p
    );
    set({ playlists: next });
    persist(next);
  },

  addSongs(playlistId, musicIds) {
    const next = get().playlists.map((p) => {
      if (p.id !== playlistId) return p;
      const existing = new Set(p.musicIds);
      const newIds = musicIds.filter((id) => !existing.has(id));
      if (newIds.length === 0) return p;
      return { ...p, musicIds: [...p.musicIds, ...newIds] };
    });
    set({ playlists: next });
    persist(next);
  },

  removeSong(playlistId, musicId) {
    const next = get().playlists.map((p) =>
      p.id === playlistId ? { ...p, musicIds: p.musicIds.filter((id) => id !== musicId) } : p
    );
    set({ playlists: next });
    persist(next);
  },

  removeSongs(playlistId, musicIds) {
    const rmSet = new Set(musicIds);
    const next = get().playlists.map((p) =>
      p.id === playlistId ? { ...p, musicIds: p.musicIds.filter((id) => !rmSet.has(id)) } : p
    );
    set({ playlists: next });
    persist(next);
  },

  setActive(id) { set({ activePlaylistId: id }); },
  setPlayMode(mode) { set({ playMode: mode }); },

  getNextSong(currentIndex: number, musicIds: string[]) {
    const { playMode } = get();
    const len = musicIds.length;
    if (len === 0) return { id: "", index: -1 };

    let nextIdx: number;
    switch (playMode) {
      case "repeat-one": nextIdx = currentIndex; break;
      case "sequential":
        if (currentIndex >= len - 1) return { id: "", index: -1 };
        nextIdx = currentIndex + 1;
        break;
      case "repeat-all": nextIdx = (currentIndex + 1) % len; break;
      case "shuffle": {
        const others = Array.from({ length: len }, (_, i) => i).filter((i) => i !== currentIndex);
        nextIdx = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : currentIndex;
        break;
      }
    }
    return { id: musicIds[nextIdx] || "", index: nextIdx };
  },
}));
