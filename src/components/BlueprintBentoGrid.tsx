// ── Cyber Grid Blueprint Home Dashboard ──
// 数据来自 useDashboardData() 共享 hook；纯布局层。

import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Video, Music, Gamepad2, Image as ImageIcon, RotateCcw, Clock, Sunrise, Sun, Moon, Calendar, Pencil } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { useTranslation } from "react-i18next";
import { TRENDING_TAGS } from "@/lib/trending";
import { useDashboardData } from "@/hooks/useDashboardData";
import TrendingCard from "@/components/TrendingCard";
import { BentoGrid, BentoItem } from "@/components/ui/blueprint-bento-grid";

// ── Editable title (hover → edit button, localStorage custom text, falls back to i18n) ──
const TITLE_KEY = "blueprint-custom-title";
function EditableBlueprintTitle({ t }: { t: (k: string) => string }) {
  const [editing, setEditing] = useState(false);
  const [customTitle, setCustomTitle] = useState(() => localStorage.getItem(TITLE_KEY) || "");
  const defaultTitle = t("home.blueprint_title");
  const display = customTitle || defaultTitle;

  const save = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) { setCustomTitle(trimmed); localStorage.setItem(TITLE_KEY, trimmed); }
    else { setCustomTitle(""); localStorage.removeItem(TITLE_KEY); }
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-center mb-6 mt-4">
      {editing ? (
        <input
          autoFocus
          defaultValue={display}
          onKeyDown={(e) => { if (e.key === "Enter") save(e.currentTarget.value); if (e.key === "Escape") { setEditing(false); } }}
          onBlur={(e) => save(e.target.value)}
          className="blueprint-title text-4xl md:text-5xl font-bold text-center bg-transparent border-b border-[rgba(0,229,255,0.4)] outline-none w-full max-w-2xl"
          style={{ color: "var(--nv-color-primary, #00e5ff)", textShadow: "0 0 8px var(--nv-color-primary, #00e5ff)" }}
        />
      ) : (
        <span className="relative inline-flex items-center group pr-10">
          <h1 className="blueprint-title text-4xl md:text-5xl font-bold text-center cursor-default">
            {display}
          </h1>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button onClick={() => setEditing(true)}
              className="w-7 h-7 flex items-center justify-center rounded-sm bg-[rgba(0,229,255,0.12)] border border-[rgba(0,229,255,0.3)] text-[#80f0ff] hover:bg-[rgba(0,229,255,0.25)] hover:scale-105 transition-all"
              title={customTitle ? "Edit" : "Edit title"}>
              <NeonIcon name="Pencil" size={14}><Pencil className="h-3.5 w-3.5" /></NeonIcon>
            </button>
            {customTitle && (
              <button onClick={() => { setCustomTitle(""); localStorage.removeItem(TITLE_KEY); }}
                className="w-7 h-7 flex items-center justify-center rounded-sm bg-[rgba(255,61,79,0.12)] border border-[rgba(255,61,79,0.3)] text-[#ff3d4f] hover:bg-[rgba(255,61,79,0.25)] hover:scale-105 transition-all"
                title="Reset">
                <NeonIcon name="RotateCcw" size={14}><RotateCcw className="h-3.5 w-3.5" /></NeonIcon>
              </button>
            )}
          </div>
        </span>
      )}
    </div>
  );
}

export default function BlueprintBentoGrid() {
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

  const renderSkeletonRow = () => (
    <div className="space-y-1 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-[rgba(0,229,255,0.06)] animate-pulse shrink-0" />
          <div className="h-3 flex-1 rounded-sm bg-[rgba(0,229,255,0.06)] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto z-10 px-4">
      <EditableBlueprintTitle t={t} />

      {/* ── Status chips ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 justify-center">
        {persona && (
          <span className="flex items-center gap-1.5 rounded-sm border border-[rgba(0,229,255,0.2)] px-3 py-1.5 text-xs text-[#80f0ff] bg-[rgba(0,229,255,0.04)]">
            <NeonIcon name="Clock" size={14}><Clock className="h-3.5 w-3.5" /></NeonIcon>
            {persona}
          </span>
        )}
        {totalActiveDays > 0 && (
          <span className="flex items-center gap-1.5 rounded-sm border border-[rgba(0,229,255,0.2)] px-3 py-1.5 text-xs text-[#c8e6ff] bg-[rgba(0,229,255,0.04)]">
            <NeonIcon name="Calendar" size={14}><Calendar className="h-3.5 w-3.5" /></NeonIcon>
            <span className="tabular-nums font-semibold">{totalActiveDays}</span>
            <span className="text-[#5c7a9e]">{t("checkin.active_days_label")}</span>
          </span>
        )}
        {streakDays >= 3 && (
          <span className="flex items-center gap-1.5 rounded-sm border border-amber-400/20 px-3 py-1.5 text-xs text-amber-300/90 bg-[rgba(251,191,36,0.04)]">
            {streakDays >= 30 ? "🔥" : "⚡"}
            <span className="tabular-nums font-semibold text-amber-200">{streakDays}</span>
            <span className="text-amber-400/70">{t("checkin.streak_label")}</span>
          </span>
        )}
      </div>

      <BentoGrid>
        {/* ── 24h Activity Heatmap ── */}
        <BentoItem className="col-span-3">
          <h2 className="text-sm font-bold text-[#80f0ff] mb-2 tracking-wider">
            [ {t("dashboard.hourly_title")} ]
          </h2>
          <div className="relative h-14">
            {/* Time-of-day backgrounds */}
            <div className="absolute inset-y-0 rounded-sm overflow-hidden pointer-events-none"
              style={{ left: `${(6/24)*100}%`, width: `${(6/24)*100}%` }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(251,191,36,0.08) 0%, rgba(253,186,116,0.04) 100%)" }} />
              <Sunrise className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-amber-400/8" />
            </div>
            <div className="absolute inset-y-0 rounded-sm overflow-hidden pointer-events-none"
              style={{ left: `${(12/24)*100}%`, width: `${(6/24)*100}%` }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(250,204,21,0.10) 0%, rgba(251,146,60,0.05) 100%)" }} />
              <Sun className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-yellow-400/8" />
            </div>
            <div className="absolute inset-y-0 rounded-sm overflow-hidden pointer-events-none"
              style={{ left: 0, width: `${(6/24)*100}%` }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(88,28,135,0.04) 100%)" }} />
              <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400/8" />
            </div>
            <div className="absolute inset-y-0 rounded-sm overflow-hidden pointer-events-none"
              style={{ left: `${(18/24)*100}%`, width: `${(6/24)*100}%` }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(88,28,135,0.04) 100%)" }} />
              <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400/8" />
            </div>
            {/* Bars */}
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
                              ? `color-mix(in srgb, var(--color-primary, #00e5ff) ${Math.round(15 + pct * 85)}%, #0a1628)`
                              : "rgba(0,229,255,0.06)",
                          }} />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20">
                          <div className="rounded-sm bg-black/95 border border-[rgba(0,229,255,0.2)] px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-lg">
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
        </BentoItem>

        {/* ── Library Composition ── */}
        <BentoItem className="col-span-2">
          <h2 className="text-sm font-bold text-[#80f0ff] mb-2 tracking-wider">
            [ {t("dashboard.library_title")} ]
          </h2>
          <div className="flex h-2 rounded-full overflow-hidden gap-[2px] mb-2.5">
            {composition.filter((c) => c.value > 0).map((c) => (
              <div key={c.key} className="transition-all duration-700" style={{ width: `${(c.value / compTotal) * 100}%`, background: c.color, minWidth: 6 }} />
            ))}
            {compTotal <= 1 && <div className="w-full bg-white/5" />}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {composition.map((c) => (
              <button key={c.key} onClick={() => navigate(`/${c.key}`)} className="flex items-center gap-1.5 text-left group">
                <c.icon className="h-3 w-3 shrink-0" style={{ color: c.color }} />
                <span className="text-[10px] text-[#c8e6ff] group-hover:text-white transition-colors">{c.label}</span>
                <span className="text-[10px] text-[#5c7a9e] ml-auto tabular-nums">{c.value}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-[rgba(0,229,255,0.1)] text-center">
            <span className="text-[10px] text-[#4a6a8a] tracking-wider uppercase">
              {t("home.blueprint_total_items", "Total")}: <span className="tabular-nums font-bold text-[#80f0ff]">{totalUp}</span>
            </span>
          </div>
        </BentoItem>

        {/* ── Steam Trending ── */}
        <BentoItem className="col-span-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[#80f0ff] tracking-wider">
              [ {t("dashboard.steam_title")} ]
            </h2>
            <span className="text-[9px] text-[#4a6a8a]">{t("dashboard.steam_source")}</span>
          </div>
          <div className="flex flex-wrap gap-1 mb-2.5">
            {TRENDING_TAGS.map((tag) => (
              <button key={tag.tag} onClick={() => setTrendTag(tag.tag)}
                className={`px-2 py-0.5 rounded-sm text-[10px] border transition-all ${
                  trendTag === tag.tag
                    ? "bg-[rgba(0,229,255,0.1)] border-[rgba(0,229,255,0.4)] text-[#80f0ff] font-semibold"
                    : "border-[rgba(0,229,255,0.1)] text-[#5c7a9e] hover:text-[#80f0ff] hover:bg-[rgba(0,229,255,0.04)]"
                }`}>
                {t(tag.labelKey)}
              </button>
            ))}
          </div>
          {trendLoading ? (
            <div className="flex gap-3 overflow-hidden pb-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 w-40">
                  <div className="rounded-sm bg-surface-lighter animate-pulse aspect-[460/215] mb-1.5" />
                  <div className="h-3 w-24 rounded-sm bg-surface-lighter animate-pulse" />
                </div>
              ))}
            </div>
          ) : trending ? (
            <div key={trendTag} className="flex gap-3 overflow-x-auto pb-1">
              {trending.games.map((g, i) => (
                <TrendingCard key={g.id} g={g} delay={i * 40} onOpen={() => openSteamPage(g.id)}
                  rounded="sm" nameColor="text-[#c8ddf0]" priceColor="text-[#6a8aa8]" />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-5 rounded-sm border border-[rgba(0,229,255,0.1)] bg-[rgba(0,229,255,0.02)]">
              <p className="text-[11px] text-[#4a6a8a]">{t("dashboard.steam_unavailable")}</p>
            </div>
          )}
        </BentoItem>

        {/* ── Top Played ── */}
        <BentoItem className="col-span-2">
          <h2 className="text-sm font-bold text-[#80f0ff] mb-2 tracking-wider flex items-center gap-1.5">
            <NeonIcon name="Music" size={14}><Music className="h-3.5 w-3.5" /></NeonIcon>
            [ {t("dashboard.top_played")} ]
          </h2>
          {stats && stats.topMusic.length > 0 ? (
            <div className="space-y-0.5">
              {stats.topMusic.slice(0, 5).map((m, i) => (
                <button key={m.id} onClick={() => navigate("/music", { state: { playId: m.id } })}
                  className="w-full flex items-center gap-2 px-1.5 py-0.5 rounded-sm text-left hover:bg-[rgba(0,229,255,0.05)] transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "forwards", minHeight: 22 }}>
                  <span className={`w-4 text-center text-[10px] font-bold tabular-nums ${i < 3 ? "text-[#80f0ff]" : "text-[#5c7a9e]"}`}>{i + 1}</span>
                  <span className="flex-1 text-[11px] text-[#c8e6ff] truncate">{m.name}</span>
                  <span className="text-[10px] text-[#4a6a8a] tabular-nums shrink-0">{m.count} {t("dashboard.times")}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[#4a6a8a] py-4 text-center">{stats ? t("dashboard.empty_played") : t("dashboard.loading")}</p>
          )}
        </BentoItem>

        {/* ── Recent Watched ── */}
        <BentoItem className="col-span-3">
          <h2 className="text-sm font-bold text-[#80f0ff] mb-2 tracking-wider flex items-center gap-1.5">
            <NeonIcon name="Video" size={14}><Video className="h-3.5 w-3.5" /></NeonIcon>
            [ {t("dashboard.recent_watched")} ]
          </h2>
          {recentWatched.length > 0 ? (
            <div className="space-y-0.5">
              {recentWatched.map((e, i) => (
                <button key={`${e.type}-${e.id}-${e.time}`}
                  onClick={() => navigate("/movies", { state: { playId: e.id } })}
                  className="w-full flex items-center gap-2 px-1.5 py-0.5 rounded-sm text-left hover:bg-[rgba(0,229,255,0.05)] transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 22 }}>
                  <span className={`w-4 text-center text-[10px] font-bold tabular-nums ${i < 3 ? "text-[#80f0ff]" : "text-[#5c7a9e]"}`}>{i + 1}</span>
                  <span className="flex-1 text-[11px] text-[#c8e6ff] truncate">{e.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[#4a6a8a] py-4 text-center">{t("dashboard.empty_watched")}</p>
          )}
        </BentoItem>

        {/* ── Trending Music ── */}
        <BentoItem className="col-span-2">
          <h2 className="text-sm font-bold text-[#80f0ff] mb-2 tracking-wider flex items-center gap-1.5">
            <span className="text-[#4a6a8a] text-[9px]">{t("dashboard.netease")}</span>
            [ {t("dashboard.trending_music")} ]
          </h2>
          {recMusic.length > 0 ? (
            <div className="space-y-0.5">
              {recMusic.slice(0, 5).map((m, i) => (
                <a key={m.id} href={m.url} target="_blank" rel="noopener"
                  className="w-full flex items-center gap-2 px-1.5 py-0.5 rounded-sm text-left hover:bg-[rgba(0,229,255,0.05)] transition-colors opacity-0 animate-fade-in-up no-underline"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 22 }}>
                  <span className={`w-4 text-center text-[10px] font-bold tabular-nums ${i < 3 ? "text-[#80f0ff]" : "text-[#5c7a9e]"}`}>{i + 1}</span>
                  <span className="flex-1 text-[11px] text-[#c8e6ff] truncate">{m.title}</span>
                  <span className="text-[10px] text-[#4a6a8a] shrink-0 truncate max-w-[72px]">{m.subtitle}</span>
                </a>
              ))}
            </div>
          ) : (
            renderSkeletonRow()
          )}
        </BentoItem>

        {/* ── Trending Movies ── */}
        <BentoItem className="col-span-3">
          <h2 className="text-sm font-bold text-[#80f0ff] mb-2 tracking-wider flex items-center gap-1.5">
            <span className="text-[#4a6a8a] text-[9px]">{t("dashboard.tmdb")}</span>
            [ {t("dashboard.trending_movies")} ]
          </h2>
          {recMovies.length > 0 ? (
            <div className="space-y-0.5">
              {recMovies.slice(0, 5).map((m, i) => (
                <a key={m.id} href={m.url} target="_blank" rel="noopener"
                  className="w-full flex items-center gap-2 px-1.5 py-0.5 rounded-sm text-left hover:bg-[rgba(0,229,255,0.05)] transition-colors opacity-0 animate-fade-in-up no-underline"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards", minHeight: 22 }}>
                  <span className={`w-4 text-center text-[10px] font-bold tabular-nums ${i < 3 ? "text-[#80f0ff]" : "text-[#5c7a9e]"}`}>{i + 1}</span>
                  <NeonIcon name="Video" size={14}><Video className="h-3 w-3 shrink-0 text-[#4a6a8a]" /></NeonIcon>
                  <span className="flex-1 text-[11px] text-[#c8e6ff] truncate">{m.title}</span>
                  {m.meta && <span className="text-[10px] text-[#4a6a8a] shrink-0 tabular-nums">{m.meta}</span>}
                </a>
              ))}
            </div>
          ) : (
            renderSkeletonRow()
          )}
        </BentoItem>

        {/* ── Revisit Recommendations ── */}
        {stats && stats.revisit.length > 0 && (
          <BentoItem className="col-span-5">
            <h2 className="text-sm font-bold text-[#80f0ff] mb-2 tracking-wider flex items-center gap-1.5">
              <NeonIcon name="RotateCcw" size={14}><RotateCcw className="h-3.5 w-3.5" /></NeonIcon>
              [ {t("dashboard.revisit_title")} ]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {stats.revisit.map((r) => (
                <button key={`${r.itemType}-${r.id}`}
                  onClick={() => navigate(r.itemType === "movie" ? "/movies" : "/music", { state: { playId: r.id } })}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[rgba(0,229,255,0.15)] text-[11px] text-[#c8e6ff] hover:bg-[rgba(0,229,255,0.08)] hover:text-white transition-colors">
                  {r.itemType === "movie" ? <NeonIcon name="Video" size={14}><Video className="h-3 w-3" /></NeonIcon> : <NeonIcon name="Music" size={14}><Music className="h-3 w-3" /></NeonIcon>}
                  <span className="max-w-[160px] truncate">{r.name}</span>
                  {r.daysSince > 0 && <span className="text-[10px] text-[#4a6a8a]">{r.daysSince}{t("dashboard.days_ago")}</span>}
                </button>
              ))}
            </div>
          </BentoItem>
        )}
      </BentoGrid>
    </div>
  );
}
