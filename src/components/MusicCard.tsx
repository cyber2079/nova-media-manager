import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Music } from "@/types/music";
import { Trash2, Tag, Clock } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tagColor";
import { getMusicCoverFallback } from "@/lib/musicCoverFallback";
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
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] theme-enter-card cursor-pointer hover:shadow-xl hover:shadow-primary/10"
      onClick={() => onPlay?.(music)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-lighter">
        <FavoriteStar active={!!favorited} onToggle={onToggleFav || (() => {})} />
        {music.coverPath ? (
          <img src={music.coverPath} alt={music.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => { (e.target as HTMLImageElement).src = getMusicCoverFallback(); }} />
        ) : (
          <img src={getMusicCoverFallback()} alt={music.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
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
        {!compact && <p className="text-xs text-gray-500 truncate mb-2">{music.artist}{music.album ? ` · ${music.album}` : ""}</p>}

        {/* 操作按钮行 */}
        <div className="flex items-center gap-1">
          {onEditTags && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light shrink-0"
              onClick={(e) => { e.stopPropagation(); onEditTags(); }} title="Edit tags">
              <NeonIcon name="Tag" size={16}><Tag className="h-3.5 w-3.5" /></NeonIcon>
            </Button>
          )}
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
