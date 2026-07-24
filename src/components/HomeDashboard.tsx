// ── 默认主题首页仪表盘 ──
// 数据来自 useDashboardData() 共享 hook；纯布局层。

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Music, Gamepad2, Image as ImageIcon, RotateCcw, Clock, Sunrise, Sun, Moon, Calendar } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { useTranslation } from "react-i18next";
import { useDashboardData } from "@/hooks/useDashboardData";
import { TRENDING_TAGS } from "@/lib/trending";
import TrendingCard from "@/components/TrendingCard";
import SafeImage from "@/components/SafeImage";

const panelClass = "rounded-2xl p-4 transition-shadow duration-300";
const panelStyle: React.CSSProperties = {
  background: "color-mix(in srgb, var(--color-primary) 4%, #080c14)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)",
};

// ── 主组件 ──
export default function HomeDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    stats, trending, trendTag, setTrendTag, trendLoading,
    recMovies, recMusic,
    openSteamPage,
    recentWatched,
    hourlyData, persona,
    totalActiveDays, streakDays,
    totalUp, composition, compTotal,
  } = useDashboardData();

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
          <span className="flex items-center gap-1.5 rounded-full border border-primary/20 px-3 py-1.5 text-xs text-primary-light">
            <NeonIcon name="Calendar" size={16}><Calendar className="h-3.5 w-3.5" /></NeonIcon>
            <span className="tabular-nums font-semibold">{totalActiveDays}</span>
            <span className="text-gray-500">{t("checkin.active_days_label")}</span>
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

      {/* ── 24h 活动热力图 ── */}
      <div className={panelClass} style={panelStyle}>
        <h2 className="text-sm font-bold text-primary-light mb-2 tracking-wider">
          [ {t("dashboard.hourly_title")} ]
        </h2>
        <div className="relative h-16">
          {/* Time-of-day backgrounds */}
          <div className="absolute inset-y-0 rounded-md overflow-hidden pointer-events-none"
            style={{ left: `${(6 / 24) * 100}%`, width: `${(6 / 24) * 100}%` }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(251,191,36,0.08) 0%, rgba(253,186,116,0.04) 100%)" }} />
            <Sunrise className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-amber-400/8" />
          </div>
          <div className="absolute inset-y-0 rounded-md overflow-hidden pointer-events-none"
            style={{ left: `${(12 / 24) * 100}%`, width: `${(6 / 24) * 100}%` }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(250,204,21,0.10) 0%, rgba(251,146,60,0.05) 100%)" }} />
            <Sun className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-yellow-400/8" />
          </div>
          <div className="absolute inset-y-0 rounded-md overflow-hidden pointer-events-none"
            style={{ left: "0%", width: `${(6 / 24) * 100}%` }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(88,28,135,0.04) 100%)" }} />
            <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400/8" />
          </div>
          <div className="absolute inset-y-0 rounded-md overflow-hidden pointer-events-none"
            style={{ left: `${(18 / 24) * 100}%`, width: `${(6 / 24) * 100}%` }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(88,28,135,0.04) 100%)" }} />
            <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400/8" />
          </div>
          {/* Bars */}
          <div className="flex gap-[2px] h-full items-end relative z-10">
            {(() => {
              const maxV = Math.max(1, ...(stats?.hourly || []));
              return hourlyData.map((d, i) => {
                const pct = d.v / maxV;
                return (
                  <div key={i} className="flex-1 relative group cursor-default"
                    style={{ height: `${Math.max(6, pct * 100)}%` }}>
                    <div className="rounded-t-md w-full h-full"
                      style={{
                        background: d.v > 0
                          ? `color-mix(in srgb, var(--color-primary) ${Math.round(20 + pct * 80)}%, #0a1628)`
                          : "rgba(99,102,241,0.06)",
                      }} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20">
                      <div className="rounded-lg bg-black/95 border border-primary/20 px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-lg">
                        {d.label}: {d.v} {t("dashboard.times")}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* ── 内容构成 + 总数 ── */}
      <div className={panelClass} style={panelStyle}>
        <h2 className="text-sm font-bold text-primary-light mb-2 tracking-wider">
          [ {t("dashboard.library_title")} ]
        </h2>
        <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] mb-2.5">
          {composition.filter((c) => c.value > 0).map((c) => (
            <div key={c.key} className="transition-all duration-700" style={{ width: `${(c.value / compTotal) * 100}%`, background: c.color, minWidth: 6 }} />
          ))}
          {compTotal <= 1 && <div className="w-full bg-white/5" />}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {composition.map((c) => (
            <button key={c.key} onClick={() => navigate(`/${c.key}`)} className="flex items-center gap-1.5 text-left group">
              <c.icon className="h-3.5 w-3.5 shrink-0" style={{ color: c.color }} />
              <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors">{c.label}</span>
              <span className="text-[11px] text-gray-500 ml-auto tabular-nums">{c.value}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-primary/10 text-center">
          <span className="text-[10px] text-gray-500 tracking-wider uppercase">
            {t("home.blueprint_total_items", "Total")}: <span className="tabular-nums font-bold text-primary-light">{totalUp}</span>
          </span>
        </div>
      </div>

      {/* ── Steam 热门 ── */}
      <div className={panelClass} style={panelStyle}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-primary-light tracking-wider">
            [ {t("dashboard.steam_title")} ]
          </h2>
          <span className="text-[9px] text-gray-500">{t("dashboard.steam_source")}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TRENDING_TAGS.map((tag) => (
            <button key={tag.tag} onClick={() => setTrendTag(tag.tag)}
              className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${
                trendTag === tag.tag
                  ? "bg-primary/10 border-primary/30 text-primary-light font-semibold"
                  : "border-white/5 text-gray-500 hover:text-primary-light hover:bg-primary/5"
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
          <div key={trendTag} className="flex gap-3 overflow-x-auto pb-1">
            {trending.games.map((g, i) => (
              <TrendingCard key={g.id} g={g} delay={i * 40} onOpen={() => openSteamPage(g.id)} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 rounded-xl border border-primary/10 bg-primary/5">
            <p className="text-[11px] text-gray-500">{t("dashboard.steam_unavailable")}</p>
          </div>
        )}
      </div>

      {/* ── 标签偏好 ── */}
      {stats && stats.topTags.length > 0 && (
        <div className={panelClass} style={panelStyle}>
          <h2 className="text-sm font-bold text-primary-light mb-2 tracking-wider">
            [ {t("dashboard.top_tags")} ]
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.topTags.slice(0, 12).map((tag) => (
              <span key={tag.tag} className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary-light border border-primary/20">
                {tag.tag} <span className="text-gray-500 ml-1">{tag.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── 最常播放 ── */}
        <div className={panelClass} style={panelStyle}>
          <h2 className="text-sm font-bold text-primary-light mb-2 tracking-wider flex items-center gap-1.5">
            <NeonIcon name="Music" size={14}><Music className="h-3.5 w-3.5" /></NeonIcon>
            [ {t("dashboard.top_played")} ]
          </h2>
          {stats && stats.topMusic.length > 0 ? (
            <div className="space-y-0.5">
              {stats.topMusic.slice(0, 5).map((m, i) => (
                <button key={m.id} onClick={() => navigate("/music", { state: { playId: m.id } })}
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "forwards" }}>
                  <span className="w-5 text-center text-[11px] font-bold tabular-nums text-primary-light">{i + 1}</span>
                  <span className="flex-1 text-[12px] text-gray-300 truncate">{m.name}</span>
                  <span className="text-[10px] text-gray-500 tabular-nums">{m.count} {t("dashboard.times")}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500 py-4 text-center">{stats ? t("dashboard.empty_played") : t("dashboard.loading")}</p>
          )}
        </div>

        {/* ── 最近观看 ── */}
        <div className={panelClass} style={panelStyle}>
          <h2 className="text-sm font-bold text-primary-light mb-2 tracking-wider flex items-center gap-1.5">
            <NeonIcon name="Video" size={14}><Video className="h-3.5 w-3.5" /></NeonIcon>
            [ {t("dashboard.recent_watched")} ]
          </h2>
          {recentWatched.length > 0 ? (
            <div className="space-y-0.5">
              {recentWatched.map((e, i) => (
                <button key={`${e.type}-${e.id}-${e.time}`}
                  onClick={() => navigate("/movies", { state: { playId: e.id } })}
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards" }}>
                  <span className="w-5 text-center text-[11px] font-bold tabular-nums text-primary-light">{i + 1}</span>
                  <SafeImage src="" alt="" className="h-7 w-5 rounded object-cover shrink-0 bg-surface-lighter"
                    fallback={<div className="h-7 w-5 rounded bg-surface-lighter flex items-center justify-center"><Video className="h-3 w-3 text-gray-600" /></div>} />
                  <span className="flex-1 text-[12px] text-gray-300 truncate">{e.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500 py-4 text-center">{t("dashboard.empty_watched")}</p>
          )}
        </div>
      </div>

      {/* ── 热门音乐 / 热门电影（双列）── */}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        <div className={panelClass} style={panelStyle}>
          <h2 className="text-sm font-bold text-primary-light mb-2 tracking-wider flex items-center gap-1.5">
            <span className="text-[#4a6a8a] text-[9px]">{t("dashboard.netease")}</span>
            [ {t("dashboard.trending_music")} ]
          </h2>
          {recMusic.length > 0 ? (
            <div className="space-y-0.5">
              {recMusic.slice(0, 5).map((m, i) => (
                <a key={m.id} href={m.url} target="_blank" rel="noopener"
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up no-underline"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards" }}>
                  <span className="w-5 text-center text-[11px] font-bold tabular-nums text-primary-light">{i + 1}</span>
                  <span className="flex-1 text-[12px] text-gray-300 truncate">{m.title}</span>
                  <span className="text-[10px] text-gray-500 shrink-0 truncate max-w-[100px]">{m.subtitle}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-primary/10 animate-pulse shrink-0" />
                  <div className="h-3 flex-1 rounded bg-primary/10 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={panelClass} style={panelStyle}>
          <h2 className="text-sm font-bold text-primary-light mb-2 tracking-wider flex items-center gap-1.5">
            <span className="text-[#4a6a8a] text-[9px]">{t("dashboard.tmdb")}</span>
            [ {t("dashboard.trending_movies")} ]
          </h2>
          {recMovies.length > 0 ? (
            <div className="space-y-0.5">
              {recMovies.slice(0, 5).map((m, i) => (
                <a key={m.id} href={m.url} target="_blank" rel="noopener"
                  className="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-left hover:bg-surface-lighter/40 transition-colors opacity-0 animate-fade-in-up no-underline"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards" }}>
                  <span className="w-5 text-center text-[11px] font-bold tabular-nums text-primary-light">{i + 1}</span>
                  <span className="flex-1 text-[12px] text-gray-300 truncate">{m.title}</span>
                  <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">{m.meta}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-primary/10 animate-pulse shrink-0" />
                  <div className="h-3 flex-1 rounded bg-primary/10 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 重温推荐 ── */}
      {stats && stats.revisit.length > 0 && (
        <div className={panelClass} style={panelStyle}>
          <h2 className="text-sm font-bold text-primary-light mb-2 tracking-wider flex items-center gap-1.5">
            <NeonIcon name="RotateCcw" size={14}><RotateCcw className="h-3.5 w-3.5" /></NeonIcon>
            [ {t("dashboard.revisit_title")} ]
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.revisit.map((r) => (
              <button key={`${r.itemType}-${r.id}`}
                onClick={() => navigate(r.itemType === "movie" ? "/movies" : "/music", { state: { playId: r.id } })}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-primary/15 text-[11px] text-gray-300 hover:bg-primary/10 hover:text-white transition-colors">
                {r.itemType === "movie" ? <NeonIcon name="Video" size={14}><Video className="h-3 w-3" /></NeonIcon> : <NeonIcon name="Music" size={14}><Music className="h-3 w-3" /></NeonIcon>}
                <span className="max-w-[160px] truncate">{r.name}</span>
                {r.daysSince > 0 && <span className="text-[10px] text-gray-500">{r.daysSince}{t("dashboard.days_ago")}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
