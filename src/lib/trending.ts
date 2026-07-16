// ── 热门推荐（服务端聚合）──
// 只连自家 scm-think.cn（CSP 白名单内），服务端聚合公开榜单并缓存。
// 本地 localStorage 6h 缓存 + 离线降级：拉取失败时用旧数据，没有旧数据则整个面板不渲染。

export interface TrendingGame {
  id: number;
  name: string;
  image: string;
  logo?: string;      // header 404 时的降级小图（服务端来自搜索接口）
  discount: number;   // 折扣百分比（0 = 无折扣）
  finalPrice: number; // 现价（分）
  currency: string;
}

export interface TrendingData {
  updatedAt: string;
  games: TrendingGame[];
}

const KEY_PREFIX = "trending-cache-v2:"; // v2：payload 增加价格回填，废弃旧缓存
const TTL = 24 * 60 * 60 * 1000; // 服务端每日刷新一次，客户端同样一天只请求一次

/** 类型筛选 chips（tag 为空 = 综合热销；id 对应 Steam 官方 tag，服务端白名单一致） */
export const TRENDING_TAGS: { tag: string; label: string }[] = [
  { tag: "", label: "热销" },
  { tag: "122", label: "RPG" },
  { tag: "19", label: "动作" },
  { tag: "21", label: "冒险" },
  { tag: "9", label: "策略" },
  { tag: "599", label: "模拟" },
  { tag: "492", label: "独立" },
  { tag: "597", label: "休闲" },
  { tag: "3799", label: "视觉小说" },
  { tag: "1667", label: "恐怖" },
];

function readCache(tag: string): { at: number; data: TrendingData } | null {
  try { return JSON.parse(localStorage.getItem(KEY_PREFIX + (tag || "top")) || "null"); } catch { return null; }
}

export async function getTrending(tag = ""): Promise<TrendingData | null> {
  const cached = readCache(tag);
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  try {
    const url = `https://scm-think.cn/api/trending${tag ? `?tag=${tag}` : ""}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`trending ${resp.status}`);
    const data = (await resp.json()) as TrendingData;
    if (!Array.isArray(data.games)) throw new Error("bad payload");
    localStorage.setItem(KEY_PREFIX + (tag || "top"), JSON.stringify({ at: Date.now(), data }));
    return data;
  } catch {
    return cached?.data ?? null; // 离线/失败/榜单未就绪 → 过期缓存兜底
  }
}

/** 格式化价格（分 → "¥75.60"），0 显示为空 */
export function fmtPrice(cents: number, currency: string): string {
  if (!cents) return "";
  const sym = currency === "CNY" ? "¥" : currency + " ";
  return `${sym}${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}
