// ── 默认主题首页仪表盘 ──
// 用户习惯可视化：KPI 行 / 活跃热力图 / 时段分布 / 内容构成 / 标签偏好 / 音乐 Top / 重温推荐。
// 数据来自 Rust dashboard_stats 一次性聚合；颜色经 useChartColors 解析（SVG 属性不解析 var()）。

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Film, Music, Gamepad2, Image as ImageIcon, RotateCcw, Clock, Sunrise, Sun, Moon, Calendar } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { useTranslation } from "react-i18next";
import { useChartColors } from "@/lib/useChartColors";
import { usePlayHistoryStore } from "@/stores/playHistoryStore";
import { getTrending, fmtPrice, TRENDING_TAGS, type TrendingData, type TrendingGame } from "@/lib/trending";
import { getRecommendMovies, getRecommendMusic, type RecItem } from "@/lib/recommend";
import { useCheckInStats } from "@/stores/checkinStore";
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

// ── 时段风格标签（四种，取活动最多的时段）──
function hourPersona(hourly: number[], t: (k: string) => string): string {
  const total = hourly.reduce((a, b) => a + b, 0);
  if (total < 5) return "";
  const sum = (a: number, b: number) => hourly.slice(a, b).reduce((x, y) => x + y, 0);
  const zones = [
    { label: t("dashboard.hourly_night"), v: sum(0, 6) },
    { label: t("dashboard.hourly_morning"), v: sum(6, 12) },
    { label: t("dashboard.hourly_afternoon"), v: sum(12, 18) },
    { label: t("dashboard.hourly_evening"), v: sum(18, 24) },
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
  const persona = stats ? hourPersona(stats.hourly, t) : "";

  // ── 签到数据 ──
  const checkInStats = useCheckInStats();
  const totalActiveDays = checkInStats?.totalActiveDays ?? 0;
  const streakDays = checkInStats?.streakDays ?? 0;

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
      {/* ── 状态 chips ── */}
      <div className="flex flex-wrap items-center gap-3">
        {persona && (
          <span className="flex items-center gap-1.5 rounded-full border border-primary/20 px-3 py-1.5 text-xs text-primary-light">
            <NeonIcon name="Clock" size={16}><Clock className="h-3.5 w-3.5" /></NeonIcon>
            {persona}
          </span>
        )}
        {totalActiveDays > 0 && (
          <span className="flex items-center gap-1.5 rounded-full border border-primary/20 px-3 py-1.5 text-xs text-[#c8ddf0]">
            <NeonIcon name="Calendar" size={16}><Calendar className="h-3.5 w-3.5 text-primary-light" /></NeonIcon>
            <span className="tabular-nums font-semibold text-white">{totalActiveDays}</span>
            <span className="text-[#8aa8c4]">{t("checkin.active_days_label")}</span>
          </span>
        )}
        {streakDays >= 3 && (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-300/90">
            {streakDays >= 30 ? "🔥" : "⚡"}
            <span className="tabular-nums font-semibold text-amber-200">{streakDays}</span>
            <span className="text-amber-400/70">{t("checkin.streak_label")}</span>
          </span>
        )}
      </div>

      {/* ── 时段 + 构成：各半行 ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className={panelClass} style={panelStyle}>
          <p className="text-[11px] text-[#9ab8d4] mb-1">{t("dashboard.hourly_title")}</p>
          {/* 24h 热力图 + 时段背景 */}
          <div className="relative h-16">
            {/* ── 3 时段背景区块 ── */}
            {/* 清晨 06:00-12:00 */}
            <div className="absolute inset-y-0 rounded-md overflow-hidden pointer-events-none"
              style={{ left: `${(6/24)*100}%`, width: `${(6/24)*100}%` }}>
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(251,191,36,0.08) 0%, rgba(253,186,116,0.04) 100%)" }} />
              <NeonIcon name="Sunrise" size={16}><Sunrise className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-7 w-7 text-amber-400/12" /></NeonIcon>
            </div>
            {/* 正午 12:00-18:00 */}
            <div className="absolute inset-y-0 rounded-md overflow-hidden pointer-events-none"
              style={{ left: `${(12/24)*100}%`, width: `${(6/24)*100}%` }}>
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(250,204,21,0.10) 0%, rgba(251,146,60,0.05) 100%)" }} />
              <NeonIcon name="Sun" size={16}><Sun className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-yellow-400/10" /></NeonIcon>
            </div>
            {/* 夜晚 00:00-06:00 + 18:00-24:00（两段） */}
            <div className="absolute inset-y-0 rounded-md overflow-hidden pointer-events-none"
              style={{ left: 0, width: `${(6/24)*100}%` }}>
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(88,28,135,0.04) 100%)" }} />
              <NeonIcon name="Moon" size={16}><Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-indigo-400/10" /></NeonIcon>
            </div>
            <div className="absolute inset-y-0 rounded-md overflow-hidden pointer-events-none"
              style={{ left: `${(18/24)*100}%`, width: `${(6/24)*100}%` }}>
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(88,28,135,0.04) 100%)" }} />
              <NeonIcon name="Moon" size={16}><Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-indigo-400/10" /></NeonIcon>
            </div>
            {/* ── 24h 热力图竖条 ── */}
            {(() => {
              const maxV = Math.max(1, ...(stats?.hourly || []));
              return (
                <div className="flex gap-[2px] h-full items-end relative z-10">
                  {hourlyData.map((d, i) => {
                    const pct = d.v / maxV;
                    return (
                      <div key={i} className="flex-1 relative group cursor-default"
                        style={{ height: `${Math.max(8, pct * 100)}%` }}>
                        <div className="rounded-t-sm w-full h-full transition-colors"
                          style={{
                            background: d.v > 0
                              ? `color-mix(in srgb, ${colors.primary} ${Math.round(15 + pct * 85)}%, #1a2530)`
                              : "rgba(255,255,255,0.04)",
                          }} />
                        {/* tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                          <div className="rounded-md bg-black/90 border border-white/10 px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-lg">
                            {`${i}:00 - ${i}:59`}: {d.v} {t("dashboard.times")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        <div className={panelClass} style={panelStyle}>
          <p className="text-[11px] text-[#9ab8d4] mb-2">{t("dashboard.library_title")}</p>
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
          <p className="text-[11px] text-[#9ab8d4]">{t("dashboard.steam_title")}</p>
          <p className="text-[10px] text-[#8aa8c4]">{t("dashboard.steam_source")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TRENDING_TAGS.map((tag) => (
            <button key={tag.tag} onClick={() => setTrendTag(tag.tag)}
              className={`px-2.5 py-1 rounded-full text-[10px] border transition-all ${
                trendTag === tag.tag
                  ? "bg-primary/15 border-primary/40 text-primary-light font-semibold"
                  : "border-white/10 text-[#8aa8c4] hover:text-white hover:bg-white/5"
              }`}>
              {t(tag.labelKey)}
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
            <p className="text-[11px] text-[#6a8aa8]">{t("dashboard.steam_unavailable")}</p>
          </div>
        )}
      </div>

      {/* ── 2×2：最常播放 | 最近观看 ── */}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        {/* 最常播放（本地） */}
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center gap-2 mb-2">
            <NeonIcon name="Music" size={16}><Music className="h-3.5 w-3.5 text-primary-light" /></NeonIcon>
            <span className="text-[11px] text-[#9ab8d4]">{t("dashboard.top_played")}</span>
          </div>
          {stats && stats.topMusic.length > 0 ? (
            <div className="space-y-0.5">
              {stats.topMusic.slice(0, 5).map((m, i) => (
                <button key={m.id} onClick={() => navigate("/music")}
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 28 }}>
                  <span className={`w-4 text-center text-xs font-bold tabular-nums ${i < 3 ? "text-primary-light" : "text-[#8aa8c4]"}`}>{i + 1}</span>
                  <span className="flex-1 text-xs text-[#c8ddf0] truncate">{m.name}</span>
                  <span className="text-[10px] text-[#8aa8c4] tabular-nums shrink-0">{m.count} {t("dashboard.times")}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[#8aa8c4] py-4 text-center">{stats ? t("dashboard.empty_played") : t("dashboard.loading")}</p>
          )}
        </div>

        {/* 最近观看（本地播放历史） */}
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center gap-2 mb-2">
            <NeonIcon name="Film" size={16}><Film className="h-3.5 w-3.5 text-primary-light" /></NeonIcon>
            <span className="text-[11px] text-[#9ab8d4]">{t("dashboard.recent_watched")}</span>
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
            <p className="text-[10px] text-[#8aa8c4] py-4 text-center">{t("dashboard.empty_watched")}</p>
          )}
        </div>
      </div>

      {/* ── 2×2：本周热歌 | 本周热映 ── */}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        {/* 本周热歌（服务端推荐） */}
        <div className={panelClass} style={panelStyle}>
          <div className="flex items-center gap-2 mb-2">
            <NeonIcon name="Music" size={16}><Music className="h-3.5 w-3.5 text-primary-light/50" /></NeonIcon>
            <span className="text-[11px] text-[#9ab8d4]">{t("dashboard.trending_music")}</span>
            <span className="text-[9px] text-[#6a8aa8] ml-auto">{t("dashboard.netease")}</span>
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
            <NeonIcon name="Film" size={16}><Film className="h-3.5 w-3.5 text-primary-light/50" /></NeonIcon>
            <span className="text-[11px] text-[#9ab8d4]">{t("dashboard.trending_movies")}</span>
            <span className="text-[9px] text-[#6a8aa8] ml-auto">{t("dashboard.tmdb")}</span>
          </div>
          {recMovies.length > 0 ? (
            <div className="space-y-0.5">
              {recMovies.slice(0, 5).map((m, i) => (
                <a key={m.id} href={m.url} target="_blank" rel="noopener"
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up no-underline"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 28 }}>
                  <span className={`w-4 text-center text-xs font-bold tabular-nums ${i < 3 ? "text-primary-light" : "text-[#8aa8c4]"}`}>{i + 1}</span>
                  <NeonIcon name="Film" size={16}><Film className="h-3.5 w-3.5 shrink-0 text-primary-light/50" /></NeonIcon>
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
            <NeonIcon name="RotateCcw" size={16}><RotateCcw className="h-3.5 w-3.5 text-primary-light" /></NeonIcon>
            <span className="text-xs text-primary-light tracking-wide">{t("dashboard.revisit_title")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.revisit.map((r) => (
              <button key={`${r.itemType}-${r.id}`}
                onClick={() => navigate(r.itemType === "movie" ? "/movies" : "/music", r.itemType === "movie" ? { state: { playId: r.id } } : undefined)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 text-xs text-[#c8ddf0] hover:bg-primary/10 hover:text-white transition-colors">
                {r.itemType === "movie" ? <NeonIcon name="Film" size={16}><Film className="h-3 w-3 text-primary-light" /></NeonIcon> : <NeonIcon name="Music" size={16}><Music className="h-3 w-3 text-primary-light" /></NeonIcon>}
                <span className="max-w-[160px] truncate">{r.name}</span>
                {r.daysSince > 0 && <span className="text-[10px] text-[#8aa8c4]">{r.daysSince}{t("dashboard.days_ago")}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
