// ── 推荐数据前端缓存 ──
// 本地 localStorage 缓存（24h TTL），每天只请求 ECS 一次。
// 有缓存直接渲染，无缓存时静默请求不阻塞 UI。

export interface RecItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  url: string;
  meta?: string;
}

const TTL = 24 * 60 * 60 * 1000; // 24h
const BASE = "https://scm-think.cn";

function readCache(key: string): RecItem[] | null {
  try {
    const raw = localStorage.getItem(`rec-${key}`);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (Date.now() - at > TTL) return null; // 过期
    return data as RecItem[];
  } catch { return null; }
}

function writeCache(key: string, data: RecItem[]) {
  localStorage.setItem(`rec-${key}`, JSON.stringify({ at: Date.now(), data }));
}

async function fetchAndCache(key: string): Promise<RecItem[]> {
  try {
    const resp = await fetch(`${BASE}/api/recommend/${key}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = (await resp.json()) as RecItem[];
    if (data.length > 0) writeCache(key, data);
    return data;
  } catch { return []; }
}

// 电影推荐：缓存优先，后台静默刷新
let _moviesPromise: Promise<RecItem[]> | null = null;
export async function getRecommendMovies(): Promise<RecItem[]> {
  const cached = readCache("movies");
  if (cached) {
    // 有缓存立刻返回，后台静默更新
    if (!_moviesPromise) {
      _moviesPromise = fetchAndCache("movies").finally(() => { _moviesPromise = null; });
    }
    return cached;
  }
  // 无缓存 → 必须等
  if (!_moviesPromise) {
    _moviesPromise = fetchAndCache("movies").finally(() => { _moviesPromise = null; });
  }
  return _moviesPromise;
}

// 音乐推荐：同上
let _musicPromise: Promise<RecItem[]> | null = null;
export async function getRecommendMusic(): Promise<RecItem[]> {
  const cached = readCache("music");
  if (cached) {
    if (!_musicPromise) {
      _musicPromise = fetchAndCache("music").finally(() => { _musicPromise = null; });
    }
    return cached;
  }
  if (!_musicPromise) {
    _musicPromise = fetchAndCache("music").finally(() => { _musicPromise = null; });
  }
  return _musicPromise;
}
