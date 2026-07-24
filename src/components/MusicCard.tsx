import { memo, useState, useEffect } from "react";
import { useMusicStore } from "@/stores/musicStore";
import { musicCoverSrc } from "@/lib/musicCoverFallback";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Music } from "@/types/music";
import { Trash2, Tag, Clock, Headphones, ImageIcon, RefreshCw, RotateCcw } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tagColor";
import FavoriteStar from "@/components/FavoriteStar";

interface MusicCardProps {
  music: Music;
  onDelete: (id: string) => void;
  onPlay?: (m: Music) => void;
  onEditTags?: () => void;
  compact?: boolean;
  favorited?: boolean;
  onToggleFav?: () => void;
}

export default memo(function MusicCard({ music, onDelete, onPlay, onEditTags, compact, favorited, onToggleFav }: MusicCardProps) {
  const [fallback, setFallback] = useState(false);
  useEffect(() => { setFallback(false); }, [music.id, music.coverPath]);
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] theme-enter-card cursor-pointer shadow-lg hover:shadow-xl hover:shadow-primary/10"
      onClick={() => onPlay?.(music)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-lighter">
        <FavoriteStar active={!!favorited} onToggle={onToggleFav || (() => {})} />
        {music.coverPath ? (
          <img src={musicCoverSrc(music.coverPath)} alt={music.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => { e.currentTarget.style.display = "none"; setFallback(true); }} />
        ) : null}
        {(!music.coverPath || fallback) && (
          <div className="absolute inset-0 flex items-center justify-center text-primary-light">
            <NeonIcon name="Headphones" size={compact ? 18 : 36}><Headphones className="h-full w-full" /></NeonIcon>
          </div>
        )}

        {/* Duration badge */}
        {music.duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white flex items-center gap-1">
            <NeonIcon name="Clock" size={16}><Clock className="h-3 w-3" /></NeonIcon>{music.duration}
          </div>
        )}
      </div>

      <CardContent className={compact ? "p-2" : "p-3"}>
        {compact ? null : (
          <div className="flex flex-wrap gap-1 mb-2" style={{ minHeight: 20 }}>
            {music.tags.map((tag) => {
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
        <h3 className={cn("truncate font-medium mb-1.5", compact ? "text-xs" : "text-sm")} title={music.name}>{music.name}</h3>

        {/* 信息行 */}
        {!compact && <p className="text-xs text-gray-500 truncate mb-2">{(music.artist || "Unknown Artist")}{music.album ? ` · ${music.album}` : ""}</p>}

        {/* 操作按钮行 */}
        <div className="flex items-center gap-1">
          {onEditTags && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light shrink-0"
              onClick={(e) => { e.stopPropagation(); onEditTags(); }} title="Edit tags">
              <NeonIcon name="Tag" size={16}><Tag className="h-3.5 w-3.5" /></NeonIcon>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light shrink-0"
            onClick={async (e) => { e.stopPropagation(); try { const { open } = await import("@tauri-apps/plugin-dialog"); const sel = await open({ multiple: false, filters: [{ name: "Images", extensions: ["jpg","jpeg","png","webp"] }] }); if (sel) { const { invoke } = await import("@tauri-apps/api/core"); await invoke("set_music_cover", { id: music.id, sourcePath: sel }); useMusicStore.getState().loadMusic(); } } catch(e) { console.error("[setMusicCover]", e); } }} title="Set custom cover">
            <NeonIcon name="ImageIcon" size={16}><ImageIcon className="h-3.5 w-3.5" /></NeonIcon>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light shrink-0"
            onClick={async (e) => { e.stopPropagation(); try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("regenerate_music_cover", { id: music.id }); useMusicStore.getState().loadMusic(); } catch(e) { console.error("[regenMusicCover]", e); } }} title="Regenerate cover">
            <NeonIcon name="RefreshCw" size={16}><RefreshCw className="h-3.5 w-3.5" /></NeonIcon>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-400/70 shrink-0"
            onClick={async (e) => { e.stopPropagation(); try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("clear_music_cover", { id: music.id }); useMusicStore.getState().loadMusic(); } catch(e) { console.error("[clearMusicCover]", e); } }} title="Reset cover to default">
            <NeonIcon name="RotateCcw" size={16}><RotateCcw className="h-3.5 w-3.5" /></NeonIcon>
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-400 shrink-0"
            onClick={(e) => { e.stopPropagation(); onDelete(music.id); }}>
            <NeonIcon name="Trash2" size={16}><Trash2 className="h-4 w-4" /></NeonIcon>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
