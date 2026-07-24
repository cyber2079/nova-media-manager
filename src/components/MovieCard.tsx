import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/SafeImage";
import { memo } from "react";
import type { Movie } from "@/types/movie";
import { Play, Trash2, Clock, Maximize, Loader2, Tag, Monitor, RefreshCw, ImageIcon } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tagColor";
import { useTranslation } from "react-i18next";
import FavoriteStar from "@/components/FavoriteStar";
import { useSettingsStore, EXTERNAL_PLAYER_EXTS } from "@/stores/settingsStore";
import { isPaid, useLicenseStore } from "@/stores/licenseStore";
import { useMovieStore } from "@/stores/movieStore";

interface MovieCardProps {
  movie: Movie;
  onDelete: (id: string) => void;
  onPlay: (movie: Movie) => void;
  onEditTags?: () => void;
  onSetWallpaper?: (path: string) => void;
  onRegenCover?: () => void;
  compact?: boolean;
  horizontal?: boolean;
  favorited?: boolean;
  onToggleFav?: () => void;
}

export default memo(function MovieCard({ movie, onDelete, onPlay, onEditTags, onSetWallpaper, onRegenCover, compact, horizontal, favorited, onToggleFav }: MovieCardProps) {
  const { t } = useTranslation();
  const isProcessing = movie.status === "processing";
  // 内置引擎放不了的格式 → 角标提示走外接（诚实化，避免"点了没声音/黑屏"的困惑）
  const extPlayer = useSettingsStore((s) => s.externalPlayer);
  const needsExternal = EXTERNAL_PLAYER_EXTS.includes((movie.format || "").toLowerCase());
  const showExtBadge = needsExternal && extPlayer.mode !== "never";

  // ── Horizontal banner layout ──
  if (horizontal) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-surface-lighter shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
        onClick={() => { if (!isProcessing) onPlay(movie); }}>
        <div className="relative aspect-[2.4/1] overflow-hidden bg-surface-lighter">
          <FavoriteStar active={!!favorited} onToggle={onToggleFav || (() => {})} />
          {showExtBadge && (
            <div className="absolute top-2 right-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">
              {extPlayer.path ? t("movie.external_player") : t("movie.need_external_player")}
            </div>
          )}
          {isProcessing ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
              <NeonIcon name="Loader2" size={16}><Loader2 className="h-8 w-8 animate-spin text-primary-light" /></NeonIcon>
              <span className="text-xs">{t("movie.processing")}</span>
            </div>
          ) : movie.coverPath ? (
            <SafeImage src={movie.coverPath} alt={movie.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" fallback={<div className="flex h-full items-center justify-center"><NeonIcon name="Play" size={16}><Play className="h-12 w-12 text-gray-600" /></NeonIcon></div>} />
          ) : (
            <div className="flex h-full items-center justify-center"><NeonIcon name="Play" size={16}><Play className="h-12 w-12 text-gray-600" /></NeonIcon></div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
            <Button size="icon" className="h-12 w-12 rounded-full opacity-0 transition-all group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onPlay(movie); }}>
              <NeonIcon name="Play" size={16}><Play className="h-5 w-5 fill-white" /></NeonIcon>
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-200 truncate">{movie.name}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{movie.duration}{movie.resolution ? ` · ${movie.resolution}` : ""}</span>
              {movie.tags && movie.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {movie.tags.slice(0, 3).map((tag) => {
                    const c = tagColor(tag);
                    return <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border" style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.fg + "40" }}>{tag}</span>;
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-primary-light" onClick={async (e) => { e.stopPropagation(); try { const { open } = await import("@tauri-apps/plugin-dialog"); const sel = await open({ multiple: false, filters: [{ name: "Images", extensions: ["jpg","jpeg","png","webp"] }] }); if (sel) { const { invoke } = await import("@tauri-apps/api/core"); await invoke("set_movie_cover", { id: movie.id, sourcePath: sel }); useMovieStore.getState().loadMovies(); } } catch {} }} title={t("movie.set_custom_cover")}>
              <NeonIcon name="ImageIcon" size={16}><ImageIcon className="h-3.5 w-3.5" /></NeonIcon>
            </Button>
            {onSetWallpaper && isPaid(useLicenseStore.getState().license.tier) && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onSetWallpaper(movie.filePath); }} title={t("movie.set_wallpaper")}>
                <NeonIcon name="Monitor" size={16}><Monitor className="h-3.5 w-3.5" /></NeonIcon>
              </Button>
            )}
            {onEditTags && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEditTags(); }} title={t("movie.edit_tags")}>
                <NeonIcon name="Tag" size={16}><Tag className="h-3.5 w-3.5" /></NeonIcon>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/70 hover:text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(movie.id); }} title={t("movie.confirm_delete")}>
              <NeonIcon name="Trash2" size={16}><Trash2 className="h-3.5 w-3.5" /></NeonIcon>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Portrait card layout ──
    return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10",
        "theme-enter-card",
        !isProcessing && "cursor-pointer"
      )}
      onClick={() => { if (!isProcessing) onPlay(movie); }}
    >
      {/* 封面区 */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-lighter">
        <FavoriteStar active={!!favorited} onToggle={onToggleFav || (() => {})} />
        {showExtBadge && (
          <div className="absolute top-2 right-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">
            {extPlayer.path ? t("movie.external_player") : t("movie.need_external_player")}
          </div>
        )}
        {isProcessing ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
            <NeonIcon name="Loader2" size={16}><Loader2 className="h-8 w-8 animate-spin text-primary-light" /></NeonIcon>
            <span className="text-xs">{t("movie.processing")}</span>
          </div>
        ) : movie.coverPath ? (
          <SafeImage
            src={movie.coverPath}
            alt={movie.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            fallback={
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-lighter to-surface">
                <NeonIcon name="Play" size={16}><Play className="h-12 w-12 text-gray-600" /></NeonIcon>
              </div>
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-lighter to-surface">
            <NeonIcon name="Play" size={16}><Play className="h-12 w-12 text-gray-600" /></NeonIcon>
          </div>
        )}

        {/* 悬浮播放按钮 */}
        {!isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
            <button
              className="h-12 w-12 rounded-full bg-primary flex items-center justify-center opacity-0 transition-all group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onPlay(movie); }}
            >
              <NeonIcon name="Play" size={16}><Play className="h-5 w-5 fill-white ml-0.5" /></NeonIcon>
            </button>
          </div>
        )}

        {/* 时长角标 */}
        {movie.duration && movie.duration !== "处理中..." && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
            {movie.duration}
          </div>
        )}

        {/* 已看角标 */}
        {movie.watched && (
          <div className="absolute bottom-2 left-2 rounded bg-primary/80 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
            {t("movie.watched")}
          </div>
        )}

        {/* 观看进度条 */}
        {!movie.watched && movie.watchPosition > 0 && movie.durationSeconds > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/50">
            <div className="h-full bg-primary-light"
              style={{ width: `${Math.min(100, (movie.watchPosition / movie.durationSeconds) * 100)}%` }} />
          </div>
        )}
      </div>

      <CardContent className={compact ? "p-2" : "p-3"}>
        {/* 标签独立一行 — 始终占位以保持卡片高度一致 */}
        {compact ? null : (
          <div className="flex flex-wrap gap-1 mb-2" style={{ minHeight: 20 }}>
            {movie.tags.map((tag) => {
              const c = tagColor(tag);
              return (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border transition-colors"
                  style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.fg + "40" }}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {/* 名称 — 单独一行 */}
        <h3 className={cn("truncate font-medium mb-1.5", compact ? "text-xs" : "text-sm")} title={movie.name}>
          {movie.name}
        </h3>

        {/* 信息行 — 分辨率 + 时长 */}
        {!compact && (
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
            {movie.resolution && movie.resolution !== "处理中..." && (
              <span className="flex items-center gap-1">
                <NeonIcon name="Maximize" size={16}><Maximize className="h-3 w-3" /></NeonIcon>
                {movie.resolution}
              </span>
            )}
            {movie.durationSeconds > 0 && (
              <span className="flex items-center gap-1">
                <NeonIcon name="Clock" size={16}><Clock className="h-3 w-3" /></NeonIcon>
                {movie.duration}
              </span>
            )}
          </div>
        )}

        {/* 操作按钮行 */}
        <div className="flex items-center gap-0.5">
          <button
            className={cn("flex items-center justify-center rounded-md text-gray-500 hover:text-primary-light hover:bg-white/5 transition-colors",
              compact ? "h-6 w-6" : "h-8 w-8")}
            onClick={async (e) => { e.stopPropagation(); try { const { open } = await import("@tauri-apps/plugin-dialog"); const sel = await open({ multiple: false, filters: [{ name: "Images", extensions: ["jpg","jpeg","png","webp"] }] }); if (sel) { const { invoke } = await import("@tauri-apps/api/core"); await invoke("set_movie_cover", { id: movie.id, sourcePath: sel }); useMovieStore.getState().loadMovies(); } } catch {} }} title={t("movie.set_custom_cover")}>
            <NeonIcon name="ImageIcon" size={16}><ImageIcon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /></NeonIcon>
          </button>
          {onSetWallpaper && (
            <button
              className={cn("flex items-center justify-center rounded-md text-gray-500 hover:text-primary-light hover:bg-white/5 transition-colors",
                compact ? "h-6 w-6" : "h-8 w-8")}
              onClick={(e) => { e.stopPropagation(); onSetWallpaper(movie.filePath); }} title={t("movie.set_wallpaper")}>
              <NeonIcon name="Monitor" size={16}><Monitor className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /></NeonIcon>
            </button>
          )}
          {onEditTags && (
            <button className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:text-primary-light hover:bg-white/5 transition-colors"
              onClick={(e) => { e.stopPropagation(); onEditTags(); }} title="Edit tags">
              <NeonIcon name="Tag" size={16}><Tag className="h-3.5 w-3.5" /></NeonIcon>
            </button>
          )}
          {onRegenCover && !isProcessing && isPaid(useLicenseStore.getState().license.tier) && (
            <button className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:text-primary-light hover:bg-white/5 transition-colors"
              onClick={(e) => { e.stopPropagation(); onRegenCover(); }} title={t("movie.regen_cover")}>
              <NeonIcon name="RefreshCw" size={16}><RefreshCw className="h-3.5 w-3.5" /></NeonIcon>
            </button>
          )}
          <div className="flex-1" />
          <button
            className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(movie.id); }}
          >
            <NeonIcon name="Trash2" size={16}><Trash2 className="h-4 w-4" /></NeonIcon>
          </button>
        </div>
      </CardContent>
    </Card>
  );
});
