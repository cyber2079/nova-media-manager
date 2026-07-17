// ── 推荐聚合（ECS 服务端缓存）──
// /api/recommend/movies — TMDB trending/week（每天 7:00/19:00 刷新）
// /api/recommend/music  — 网易云热歌榜
// localhost:1420 dev 时走 http://localhost:3000/api/... 本地服务

export interface RecItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  url: string;
  meta?: string;
}

const BASE = import.meta.env.DEV ? "http://localhost:3000" : "https://scm-think.cn";

export async function getRecommendMovies(): Promise<RecItem[]> {
  try {
    const resp = await fetch(`${BASE}/api/recommend/movies`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return (await resp.json()) as RecItem[];
  } catch { return []; }
}

export async function getRecommendMusic(): Promise<RecItem[]> {
  try {
    const resp = await fetch(`${BASE}/api/recommend/music`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return (await resp.json()) as RecItem[];
  } catch { return []; }
}
