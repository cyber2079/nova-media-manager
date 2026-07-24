// ── 仪表盘共享数据 Hook ──
// HomeDashboard / BlueprintBentoGrid / 未来主题 Dashboard 共用。
// 所有数据获取逻辑集中在此，避免 ~60 行重复代码。

import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useChartColors } from "@/lib/useChartColors";
import { usePlayHistoryStore } from "@/stores/playHistoryStore";
import { getTrending, TRENDING_TAGS, type TrendingData } from "@/lib/trending";
import { getRecommendMovies, getRecommendMusic, type RecItem } from "@/lib/recommend";
import { useCheckInStats } from "@/stores/checkinStore";
import { hourPersona } from "@/lib/hourPersona";
import { useCountUp } from "@/hooks/useCountUp";
import type { Stats } from "@/lib/dashboardTypes";
import { Video, Music, Gamepad2, Image as ImageIcon } from "lucide-react";

export function useDashboardData() {
  const { t, i18n } = useTranslation();
  const colors = useChartColors();
  const [stats, setStats] = useState<Stats | null>(null);
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendTag, setTrendTag] = useState(() => localStorage.getItem("trending-tag") || "");
  const [recMovies, setRecMovies] = useState<RecItem[]>([]);
  const [recMusic, setRecMusic] = useState<RecItem[]>([]);

  // Dashboard stats
  useEffect(() => {
    invoke<Stats>("dashboard_stats").then(setStats).catch(() => {});
  }, []);

  // Steam trending
  useEffect(() => {
    localStorage.setItem("trending-tag", trendTag);
    let cancelled = false;
    setTrendLoading(true);
    setTrending(null);
    getTrending(trendTag, i18n.language === "zh" ? "zh" : "en")
      .then((d) => { if (!cancelled) setTrending(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTrendLoading(false); });
    return () => { cancelled = true; };
  }, [trendTag]);

  // Recommendations
  useEffect(() => {
    getRecommendMovies().then(setRecMovies).catch(() => {});
    getRecommendMusic().then(setRecMusic).catch(() => {});
  }, []);

  // Steam store page
  const openSteamPage = (appId: number) => {
    import("@tauri-apps/plugin-shell")
      .then((m) => m.open(`https://store.steampowered.com/app/${appId}/`))
      .catch(() => {});
  };

  // Play history
  const playHistory = usePlayHistoryStore((s) => s.recent);
  const recentWatched = useMemo(() =>
    playHistory.filter((e) => e.type === "movie").slice(0, 5),
  [playHistory]);

  // Hourly
  const hourlyData = useMemo(() =>
    (stats?.hourly || new Array(24).fill(0)).map((v, h) => ({ h, v, label: `${h}:00` })),
  [stats]);
  const persona = useMemo(() =>
    stats ? hourPersona(stats.hourly, t) : "",
  [stats?.hourly, t]);

  // Check-in
  const checkInStats = useCheckInStats();
  const totalActiveDays = checkInStats?.totalActiveDays ?? 0;
  const streakDays = checkInStats?.streakDays ?? 0;

  // Library composition
  const total = stats ? stats.library.movies + stats.library.music + stats.library.games + stats.imagesCount : 0;
  const totalUp = useCountUp(total);

  const composition = stats ? [
    { key: "movies", label: t("nav.movies"), value: stats.library.movies, color: colors.primary, icon: Video },
    { key: "music", label: t("nav.music"), value: stats.library.music, color: colors.accent, icon: Music },
    { key: "games", label: t("nav.games"), value: stats.library.games, color: colors.primaryDark, icon: Gamepad2 },
    { key: "images", label: t("nav.images"), value: stats.imagesCount, color: colors.primaryLight, icon: ImageIcon },
  ] : [];
  const compTotal = Math.max(1, composition.reduce((a, c) => a + c.value, 0));

  return {
    stats, trending, trendTag, setTrendTag, trendLoading,
    recMovies, recMusic,
    openSteamPage,
    recentWatched,
    hourlyData, persona,
    totalActiveDays, streakDays,
    total, totalUp, composition, compTotal, colors,
  };
}
