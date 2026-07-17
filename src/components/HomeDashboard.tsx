// ── 默认主题首页仪表盘 ──
// 用户习惯可视化：KPI 行 / 活跃热力图 / 时段分布 / 内容构成 / 标签偏好 / 音乐 Top / 重温推荐。
// 数据来自 Rust dashboard_stats 一次性聚合；颜色经 useChartColors 解析（SVG 属性不解析 var()）。

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { Film, Music, Gamepad2, Image as ImageIcon, Minimize2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { useChartColors, withAlpha } from "@/lib/useChartColors";
import { usePlayHistoryStore } from "@/stores/playHistoryStore";
import { getTrending, fmtPrice, TRENDING_TAGS, type TrendingData, type TrendingGame } from "@/lib/trending";
import { getRecommendMovies, getRecommendMusic, type RecItem } from "@/lib/recommend";
import SafeImage from "@/components/SafeImage";

// ── 类型（对应 Rust DashboardStats）──
interface DailyCount { date: string; movies: number; music: number; games: number; total: number }
interface TypeCounts { movies: number; music: number; games: number }
interface TopItem { id: string; name: string; count: number; coverPath: string }
interface TagCount { tag: string; count: number }
interface RevisitItem { id: string; name: string; itemType: string; daysSince: number }
interface Stats {
  daily: DailyCount[]; hourly: number[];
  weekNow: TypeCounts; weekPrev: TypeCounts;
  topMusic: TopItem[]; topTags: TagCount[]; revisit: RevisitItem[];
  library: TypeCounts; imagesCount: number;
}

// ── 数字 count-up 动画 ──
function useCountUp(target: number, ms = 700): number {
  const [v, setV] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current && target === 0) { setV(0); return; }
    started.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const panelStyle: React.CSSProperties = { background: "color-mix(in srgb, var(--color-primary) 4%, #080c14)" };
const panelClass = "rounded-2xl border border-primary/20 p-4";

// ── 热门游戏卡：图片三级降级（header → 搜索小图 → 文字卡），卡片永不消失 ──
// 此前 onError 直接 display:none 整卡，404 图连环隐藏 = "逐个被过滤"的残影观感
function TrendingCard({ g, delay, onOpen }: { g: TrendingGame; delay: number; onOpen: () => void }) {
  const [src, setSrc] = useState(g.image);
  const [failed, setFailed] = useState(false);
  const handleError = () => {
    if (g.logo && src !== g.logo) setSrc(g.logo);
    else setFailed(true);
  };
  return (
    <button onClick={onOpen} className="shrink-0 w-40 text-left group opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}>
      <div className="relative rounded-lg overflow-hidden bg-surface-lighter aspect-[460/215] mb-1.5">
        {failed ? (
          <div className="w-full h-full flex items-center justify-center px-2"
            style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 25%, #101520), #101520)" }}>
            <span className="text-[11px] text-white/80 text-center leading-tight">{g.name}</span>
          </div>
        ) : (
          <img src={src} alt="" loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={handleError} />
        )}
        {g.discount > 0 && (
          <span className="absolute top-1 right-1 rounded bg-green-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">-{g.discount}%</span>
        )}
      </div>
      <p className="text-[11px] text-[#c8ddf0] truncate group-hover:text-white transition-colors">{g.name}</p>
      {fmtPrice(g.finalPrice, g.currency) && (
        <p className="text-[10px] text-[#8aa8c4] tabular-nums">{fmtPrice(g.finalPrice, g.currency)}</p>
      )}
    </button>
  );
}

// ── 一句话周报：模板按数据特征确定性选择（同数据同句，不随机跳）──
function weeklyStory(stats: Stats): { text: string; emoji: string } {
  const n = stats.weekNow, p = stats.weekPrev;
  const total = n.movies + n.music + n.games;
  const prevTotal = p.movies + p.music + p.games;

  if (total === 0) {
    return prevTotal > 0
      ? { text: "这周静悄悄的，上周的热闹还在么？收藏夹里的老朋友们等你回来", emoji: "🍿" }
      : { text: "开始播放电影、听歌或启动游戏，这里会写下属于你的一周", emoji: "✨" };
  }

  const parts: string[] = [];
  if (n.movies > 0) parts.push(`看了 ${n.movies} 部电影`);
  if (n.music > 0) parts.push(`听了 ${n.music} 首歌`);
  if (n.games > 0) parts.push(`进了 ${n.games} 次游戏`);
  const body = parts.join("、");

  const dom = [
    { k: "movies", v: n.movies, e: "🎬", tail: "影迷本色" },
    { k: "music", v: n.music, e: "🎵", tail: "耳朵很忙" },
    { k: "games", v: n.games, e: "🎮", tail: "游戏时间称王" },
  ].sort((a, b) => b.v - a.v)[0];

  const trend = prevTotal === 0 ? "好的开始"
    : total > prevTotal * 1.5 ? "比上周投入多了不少"
    : total > prevTotal ? "比上周更来劲了"
    : total < prevTotal / 2 ? "比上周收敛许多，忙起来了？"
    : total < prevTotal ? "比上周悠着点了"
    : "和上周旗鼓相当";

  return { text: `这周你${body} — ${dom.tail}，${trend}`, emoji: dom.e };
}

// ── 时段风格标签（四种，取活动最多的时段）──
function hourPersona(hourly: number[]): string {
  const total = hourly.reduce((a, b) => a + b, 0);
  if (total < 5) return "";
  const sum = (a: number, b: number) => hourly.slice(a, b).reduce((x, y) => x + y, 0);
  const zones = [
    { label: "🌙 深夜党 — 凌晨是你的主场", v: sum(0, 6) },
    { label: "🌅 早起鸟 — 一日之计在于晨", v: sum(6, 12) },
    { label: "☀️ 午后型 — 下午的时光最惬意", v: sum(12, 18) },
    { label: "🌆 夜猫子 — 晚间黄金档选手", v: sum(18, 24) },
  ];
  return zones.reduce((a, b) => (b.v > a.v ? b : a)).label;
}

// ── 主组件 ──
export default function HomeDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const colors = useChartColors();
  const [stats, setStats] = useState<Stats | null>(null);
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendTag, setTrendTag] = useState(() => localStorage.getItem("trending-tag") || "");
  const [recMovies, setRecMovies] = useState<RecItem[]>([]);
  const [recMusic, setRecMusic] = useState<RecItem[]>([]);

  useEffect(() => {
    invoke<Stats>("dashboard_stats").then(setStats).catch(() => {});
  }, []);

  // 类型切换：立即清空旧榜（避免逐卡 diff 的"延迟移除"残影），骨架过渡，新榜整条替换
  useEffect(() => {
    localStorage.setItem("trending-tag", trendTag);
    let cancelled = false;
    setTrendLoading(true);
    setTrending(null);
    getTrending(trendTag)
      .then((d) => { if (!cancelled) setTrending(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTrendLoading(false); });
    return () => { cancelled = true; };
  }, [trendTag]);

  useEffect(() => { getRecommendMovies().then(setRecMovies).catch(() => {}); }, []);
  useEffect(() => { getRecommendMusic().then(setRecMusic).catch(() => {}); }, []);

  const openSteamPage = (appId: number) => {
    import("@tauri-apps/plugin-shell")
      .then((m) => m.open(`https://store.steampowered.com/app/${appId}/`))
      .catch(() => {});
  };

  // 最近观看：播放历史中只取电影
  const playHistory = usePlayHistoryStore((s) => s.recent);
  const recentWatched = useMemo(() =>
    playHistory.filter((e) => e.type === "movie").slice(0, 5),
  [playHistory]);

  const total = stats ? stats.library.movies + stats.library.music + stats.library.games + stats.imagesCount : 0;
  const totalUp = useCountUp(total);

  const hourlyData = useMemo(() =>
    (stats?.hourly || new Array(24).fill(0)).map((v, h) => ({ h, v, label: `${h}:00` })),
  [stats]);
  const persona = stats ? hourPersona(stats.hourly) : "";

  // 内容构成
  const composition = stats ? [
    { key: "movies", label: t("nav.movies"), value: stats.library.movies, color: colors.primary, icon: Film },
    { key: "music", label: t("nav.music"), value: stats.library.music, color: colors.accent, icon: Music },
    { key: "games", label: t("nav.games"), value: stats.library.games, color: colors.primaryDark, icon: Gamepad2 },
    { key: "images", label: t("nav.images"), value: stats.imagesCount, color: colors.primaryLight, icon: ImageIcon },
  ] : [];
  const compTotal = Math.max(1, composition.reduce((a, c) => a + c.value, 0));

  return (
    <div className="space-y-5">
      {/* ── 头部：总量 + 收缩按钮 ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-2xl border border-primary/20 p-5" style={panelStyle}>
          <p className="inline-block rounded-full border border-primary/30 px-3 py-1 text-xs text-primary-light">
            {t("home.total_count", { count: totalUp })}
          </p>
        </div>
        <button onClick={() => useSettingsStore.getState().setDashboardMode("strip")}
          className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-surface-lighter transition-colors border border-primary/10"
          title="收缩为迷你条">
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      {/* ── 一句话周报 ── */}
      {stats && (() => {
        const story = weeklyStory(stats);
        return (
          <div className={`${panelClass} flex items-center gap-3`} style={panelStyle}>
            <span className="text-xl shrink-0">{story.emoji}</span>
            <p className="text-sm text-[#c8ddf0] leading-relaxed">{story.text}</p>
          </div>
        );
      })()}

      {/* ── 时段 + 构成：各半行 ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-[#9ab8d4]">时段习惯</p>
            {persona && <p className="text-[10px] text-primary-light truncate ml-2">{persona}</p>}
          </div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="h" ticks={[0, 6, 12, 18, 23]} tick={{ fontSize: 9, fill: colors.fontSecondary }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }}
                  contentStyle={{ background: "rgba(8,12,20,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  labelFormatter={(h) => `${h}:00 - ${h}:59`} formatter={(v) => [`${v} 次`, "活动"]} />
                <Bar dataKey="v" radius={[2, 2, 0, 0]} animationDuration={800}>
                  {hourlyData.map((d, i) => (
                    <Cell key={i} fill={withAlpha(colors.primary, d.v > 0 ? 0.85 : 0.15)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelClass} style={panelStyle}>
          <p className="text-[11px] text-[#9ab8d4] mb-2">媒体库构成</p>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] mb-2.5">
            {composition.filter((c) => c.value > 0).map((c) => (
              <div key={c.key} className="transition-all duration-700" style={{ width: `${(c.value / compTotal) * 100}%`, background: c.color, minWidth: 6 }} />
            ))}
            {compTotal <= 1 && <div className="w-full bg-white/5" />}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {composition.map((c) => (
              <button key={c.key} onClick={() => navigate(`/${c.key}`)} className="flex items-center gap-1.5 text-left group">
                <c.icon className="h-3 w-3 shrink-0" style={{ color: c.color }} />
                <span className="text-[10px] text-[#c8ddf0] group-hover:text-white transition-colors">{c.label}</span>
                <span className="text-[10px] text-[#8aa8c4] ml-auto tabular-nums">{c.value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Steam 热门 ── */}
      <div className={panelClass} style={panelStyle}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-[#9ab8d4]">🔥 Steam 热销榜</p>
          <p className="text-[10px] text-[#8aa8c4]">数据来自 Steam 官方</p>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TRENDING_TAGS.map((t) => (
            <button key={t.tag} onClick={() => setTrendTag(t.tag)}
              className={`px-2.5 py-1 rounded-full text-[10px] border transition-all ${
                trendTag === t.tag
                  ? "bg-primary/15 border-primary/40 text-primary-light font-semibold"
                  : "border-white/10 text-[#8aa8c4] hover:text-white hover:bg-white/5"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {trendLoading ? (
          <div className="flex gap-3 overflow-hidden pb-1 -mx-1 px-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-40">
                <div className="rounded-lg bg-surface-lighter animate-pulse aspect-[460/215] mb-1.5" />
                <div className="h-3 w-24 rounded bg-surface-lighter animate-pulse" />
              </div>
            ))}
          </div>
        ) : trending ? (
          <div key={trendTag} className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {trending.games.map((g, i) => (
              <TrendingCard key={g.id} g={g} delay={i * 40} onOpen={() => openSteamPage(g.id)} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-5 rounded-lg border border-white/5 bg-surface/30">
            <p className="text-[11px] text-[#6a8aa8]">Steam 热销榜暂不可用，稍后再来</p>
          </div>
        )}
      </div>

      {/* ── 2×2：最常播放 | 最近观看 ── */}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        {/* 最常播放（本地） */}
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Music className="h-3.5 w-3.5 text-primary-light" />
            <span className="text-[11px] text-[#9ab8d4]">最常播放</span>
          </div>
          {stats && stats.topMusic.length > 0 ? (
            <div className="space-y-0.5">
              {stats.topMusic.slice(0, 5).map((m, i) => (
                <button key={m.id} onClick={() => navigate("/music")}
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 28 }}>
                  <span className={`w-4 text-center text-xs font-bold tabular-nums ${i < 3 ? "text-primary-light" : "text-[#8aa8c4]"}`}>{i + 1}</span>
                  <span className="flex-1 text-xs text-[#c8ddf0] truncate">{m.name}</span>
                  <span className="text-[10px] text-[#8aa8c4] tabular-nums shrink-0">{m.count} 次</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[#8aa8c4] py-4 text-center">{stats ? "播放后出现在这里" : "加载中…"}</p>
          )}
        </div>

        {/* 最近观看（本地播放历史） */}
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Film className="h-3.5 w-3.5 text-primary-light" />
            <span className="text-[11px] text-[#9ab8d4]">最近观看</span>
          </div>
          {recentWatched.length > 0 ? (
            <div className="space-y-0.5">
              {recentWatched.map((e, i) => (
                <button key={`${e.type}-${e.id}-${e.time}`}
                  onClick={() => navigate("/movies", { state: { playId: e.id } })}
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 28 }}>
                  <span className={`w-4 text-center text-xs font-bold tabular-nums ${i < 3 ? "text-primary-light" : "text-[#8aa8c4]"}`}>{i + 1}</span>
                  <span className="flex-1 text-xs text-[#c8ddf0] truncate">{e.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[#8aa8c4] py-4 text-center">播放电影或音乐后出现在这里</p>
          )}
        </div>
      </div>

      {/* ── 2×2：本周热歌 | 本周热映 ── */}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        {/* 本周热歌（服务端推荐） */}
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Music className="h-3.5 w-3.5 text-primary-light/50" />
            <span className="text-[11px] text-[#9ab8d4]">本周热歌</span>
            <span className="text-[9px] text-[#6a8aa8] ml-auto">网易云</span>
          </div>
          {recMusic.length > 0 ? (
            <div className="space-y-0.5">
              {recMusic.slice(0, 5).map((m, i) => (
                <a key={m.id} href={m.url} target="_blank" rel="noopener"
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up no-underline"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 28 }}>
                  <span className={`w-4 text-center text-xs font-bold tabular-nums ${i < 3 ? "text-primary-light" : "text-[#8aa8c4]"}`}>{i + 1}</span>
                  <span className="flex-1 text-xs text-[#c8ddf0] truncate">{m.title}</span>
                  <span className="text-[10px] text-[#8aa8c4] shrink-0 truncate max-w-[72px]">{m.subtitle}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-surface-lighter animate-pulse shrink-0" />
                  <div className="h-3 flex-1 rounded bg-surface-lighter animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 本周热映（服务端推荐） */}
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Film className="h-3.5 w-3.5 text-primary-light/50" />
            <span className="text-[11px] text-[#9ab8d4]">本周热映</span>
            <span className="text-[9px] text-[#6a8aa8] ml-auto">TMDB</span>
          </div>
          {recMovies.length > 0 ? (
            <div className="space-y-0.5">
              {recMovies.slice(0, 5).map((m, i) => (
                <a key={m.id} href={m.url} target="_blank" rel="noopener"
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up no-underline"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 28 }}>
                  <span className={`w-4 text-center text-xs font-bold tabular-nums ${i < 3 ? "text-primary-light" : "text-[#8aa8c4]"}`}>{i + 1}</span>
                  <Film className="h-3.5 w-3.5 shrink-0 text-primary-light/50" />
                  <span className="flex-1 text-xs text-[#c8ddf0] truncate">{m.title}</span>
                  {m.meta && <span className="text-[10px] text-[#8aa8c4] shrink-0 tabular-nums">{m.meta}</span>}
                </a>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-surface-lighter animate-pulse shrink-0" />
                  <div className="h-3 flex-1 rounded bg-surface-lighter animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 重温推荐 ── */}
      {stats && stats.revisit.length > 0 && (
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="h-3.5 w-3.5 text-primary-light" />
            <span className="text-xs text-primary-light tracking-wide">好久不见 — 你收藏过的</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.revisit.map((r) => (
              <button key={`${r.itemType}-${r.id}`}
                onClick={() => navigate(r.itemType === "movie" ? "/movies" : "/music", r.itemType === "movie" ? { state: { playId: r.id } } : undefined)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 text-xs text-[#c8ddf0] hover:bg-primary/10 hover:text-white transition-colors">
                {r.itemType === "movie" ? <Film className="h-3 w-3 text-primary-light" /> : <Music className="h-3 w-3 text-primary-light" />}
                <span className="max-w-[160px] truncate">{r.name}</span>
                {r.daysSince > 0 && <span className="text-[10px] text-[#8aa8c4]">{r.daysSince}天前</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
