// ── SQLite-backed persistent store (replaces localStorage) ──
// All data lives in %APPDATA%/media_library.db via Tauri commands.
// Falls back gracefully when running outside Tauri (dev/browser).

let _tauri: typeof import("@tauri-apps/api/core") | null = null;
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!_tauri) {
    try { _tauri = await import("@tauri-apps/api/core"); } catch { _tauri = null; }
  }
  if (!_tauri) throw new Error("Tauri not available");
  return _tauri.invoke<T>(cmd, args ?? {});
}

function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

// ── KV Store (settings, theme, language, layout, etc.) ──

export const kv = {
  async get(key: string): Promise<string | null> {
    if (!isTauri()) return localStorage.getItem(key);
    try { return await invoke<string | null>("kv_get", { key }); } catch { return localStorage.getItem(key); }
  },
  async set(key: string, value: string): Promise<void> {
    if (!isTauri()) { localStorage.setItem(key, value); return; }
    try { await invoke("kv_set", { key, value }); } catch { localStorage.setItem(key, value); }
  },
  async delete(key: string): Promise<void> {
    if (!isTauri()) { localStorage.removeItem(key); return; }
    try { await invoke("kv_delete", { key }); } catch { localStorage.removeItem(key); }
  },
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await kv.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  async setJSON<T>(key: string, value: T): Promise<void> {
    await kv.set(key, JSON.stringify(value));
  },
};

// ── Playlists ──

export interface PlaylistRow {
  id: string;
  name: string;
  musicIds: string;
  createdAt: string;
}

export const playlists = {
  async getAll(): Promise<PlaylistRow[]> {
    if (!isTauri()) {
      try { return JSON.parse(localStorage.getItem("app-playlists") || "[]"); } catch { return []; }
    }
    try { return await invoke<PlaylistRow[]>("pl_get_all"); } catch {
      try { return JSON.parse(localStorage.getItem("app-playlists") || "[]"); } catch { return []; }
    }
  },
  async save(pl: PlaylistRow): Promise<void> {
    if (!isTauri()) { return; }
    try { await invoke("pl_save", { playlist: pl }); } catch {}
  },
  async delete(id: string): Promise<void> {
    if (!isTauri()) { return; }
    try { await invoke("pl_delete", { id }); } catch {}
  },
  async saveAll(pls: PlaylistRow[]): Promise<void> {
    if (!isTauri()) {
      localStorage.setItem("app-playlists", JSON.stringify(pls));
      return;
    }
    try { await invoke("pl_save_all", { playlists: pls }); } catch {
      localStorage.setItem("app-playlists", JSON.stringify(pls));
    }
  },
};

// ── Favorites ──

export interface FavItem {
  itemId: string;
  itemType: string;
}

export const favorites = {
  async getAll(): Promise<FavItem[]> {
    if (!isTauri()) {
      try { return JSON.parse(localStorage.getItem("app-favorites") || "[]"); } catch { return []; }
    }
    try { return await invoke<FavItem[]>("fav_get_all"); } catch {
      try { return JSON.parse(localStorage.getItem("app-favorites") || "[]"); } catch { return []; }
    }
  },
  async toggle(itemId: string, itemType: string): Promise<boolean> {
    if (!isTauri()) {
      const items = await favorites.getAll();
      const idx = items.findIndex((f) => f.itemId === itemId && f.itemType === itemType);
      if (idx >= 0) { items.splice(idx, 1); } else { items.push({ itemId, itemType }); }
      localStorage.setItem("app-favorites", JSON.stringify(items));
      return idx < 0;
    }
    try { return await invoke<boolean>("fav_toggle", { itemId, itemType }); } catch { return false; }
  },
};

// ── Play History ──

export interface PlayEventRow {
  id: string;
  name: string;
  type: string;
  playedAt: string;
}

export const playHistory = {
  async getRecent(limit = 20): Promise<PlayEventRow[]> {
    if (!isTauri()) {
      try { return JSON.parse(localStorage.getItem("app-play-history") || "[]").slice(0, limit); } catch { return []; }
    }
    try { return await invoke<PlayEventRow[]>("hist_get_recent", { limit }); } catch {
      try { return JSON.parse(localStorage.getItem("app-play-history") || "[]").slice(0, limit); } catch { return []; }
    }
  },
  async add(event: PlayEventRow): Promise<void> {
    if (!isTauri()) {
      const items = await playHistory.getRecent(100);
      items.unshift(event);
      localStorage.setItem("app-play-history", JSON.stringify(items.slice(0, 100)));
      return;
    }
    try { await invoke("hist_add", { event }); } catch {}
  },
  async clear(): Promise<void> {
    if (!isTauri()) { localStorage.removeItem("app-play-history"); return; }
    try { await invoke("hist_clear"); } catch { localStorage.removeItem("app-play-history"); }
  },
};

// ── Music Cache ──

export interface MusicCacheEntry {
  id: string;
  name: string;
  filePath: string;
  coverPath: string;
  artist: string;
  album: string;
  duration: string;
  fileSize: number;
  tags: string;
  addTime: string;
}

export const musicCache = {
  async getAll(): Promise<MusicCacheEntry[]> {
    if (!isTauri()) {
      try { return JSON.parse(localStorage.getItem("app-music") || "[]"); } catch { return []; }
    }
    try { return await invoke<MusicCacheEntry[]>("mc_get_all"); } catch {
      try { return JSON.parse(localStorage.getItem("app-music") || "[]"); } catch { return []; }
    }
  },
  async save(entries: MusicCacheEntry[]): Promise<void> {
    if (!isTauri()) {
      localStorage.setItem("app-music", JSON.stringify(entries));
      return;
    }
    try { await invoke("mc_save", { entries }); } catch {
      localStorage.setItem("app-music", JSON.stringify(entries));
    }
  },
  async delete(ids: string[]): Promise<void> {
    if (!isTauri()) { return; }
    try { await invoke("mc_delete", { ids }); } catch {}
  },
};

// ── One-time migration: localStorage → SQLite ──

const MIGRATED_KEY = "__sqlite_migrated_v1";

export async function migrateFromLocalStorage(): Promise<void> {
  if (!isTauri()) return;
  const done = await kv.get(MIGRATED_KEY);
  if (done === "1") return;

  const ls = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

  // Settings
  const settings = ls("app-settings");
  if (settings) await kv.set("app-settings", settings);

  // Theme
  const theme = ls("app-theme");
  if (theme) await kv.set("app-theme", theme);

  // Language
  const lang = ls("app-lang");
  if (lang) await kv.set("app-lang", lang);

  // Layout modes
  for (const k of ["layout-music", "layout-movies", "layout-images", "layout-games"]) {
    const v = ls(k);
    if (v) await kv.set(k, v);
  }

  // Music-bg-no-ask
  const noAsk = ls("music-bg-no-ask");
  if (noAsk) await kv.set("music-bg-no-ask", noAsk);

  // Favorites
  const favs = ls("app-favorites");
  if (favs) {
    try {
      const items: FavItem[] = JSON.parse(favs);
      for (const f of items) {
        await invoke("fav_toggle", { itemId: f.itemId, itemType: f.itemType }).catch(() => {});
      }
    } catch {}
  }

  // Play history
  const hist = ls("app-play-history");
  if (hist) {
    try {
      const items: PlayEventRow[] = JSON.parse(hist);
      for (const e of items.slice(0, 50)) {
        await invoke("hist_add", { event: e }).catch(() => {});
      }
    } catch {}
  }

  // Playlists
  const pls = ls("app-playlists");
  if (pls) {
    try {
      const items: PlaylistRow[] = JSON.parse(pls);
      await invoke("pl_save_all", { playlists: items }).catch(() => {});
    } catch {}
  }

  // Music cache
  const mc = ls("app-music");
  if (mc) {
    try {
      const items: MusicCacheEntry[] = JSON.parse(mc);
      await invoke("mc_save", { entries: items }).catch(() => {});
    } catch {}
  }

  // Widget store
  const widgets = ls("app-widgets");
  if (widgets) await kv.set("app-widgets", widgets);

  await kv.set(MIGRATED_KEY, "1");
}
