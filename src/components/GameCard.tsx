import { memo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Game } from "@/types/game";
import { Play, Trash2, Monitor, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tagColor";
import FavoriteStar from "@/components/FavoriteStar";

const iconCache = new Map<string, string>();

async function getExeIcon(path: string): Promise<string | null> {
  if (iconCache.has(path)) return iconCache.get(path)!;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const dataUrl: string = await invoke("extract_exe_icon", { path });
    if (dataUrl) { iconCache.set(path, dataUrl); return dataUrl; }
  } catch {}
  iconCache.set(path, "");
  return null;
}

interface GameCardProps {
  game: Game;
  onDelete: (id: string) => void;
  onLaunch: (game: Game) => void;
  onEditTags?: () => void;
  compact?: boolean;
  favorited?: boolean;
  onToggleFav?: () => void;
}

export default memo(function GameCard({ game, onDelete, onLaunch, onEditTags, compact, favorited, onToggleFav }: GameCardProps) {
  const [coverSrc, setCoverSrc] = useState<string>("");

  // Load exe icon as cover when no custom cover path exists
  useEffect(() => {
    if (!game.executablePath) return;
    let cancelled = false;
    getExeIcon(game.executablePath).then((url) => {
      if (!cancelled && url) setCoverSrc(url);
    });
    return () => { cancelled = true; };
  }, [game.executablePath]);

  return (
    <Card
      className="group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] theme-enter-card hover:shadow-xl hover:shadow-primary/10 cursor-pointer"
      onClick={() => onLaunch(game)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-lighter">
        <FavoriteStar active={!!favorited} onToggle={onToggleFav || (() => {})} />
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-lighter to-surface">
          {coverSrc ? (
            <img src={coverSrc} alt={game.name} className="h-full w-full object-cover" />
          ) : (
            <Monitor className="h-16 w-16 text-gray-600" />
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
          <Button size="icon" className="h-12 w-12 rounded-full opacity-0 transition-all group-hover:opacity-100"
            onClick={() => onLaunch(game)}>
            <Play className="h-5 w-5 fill-white" />
          </Button>
        </div>

      </div>

      <CardContent className={compact ? "p-2" : "p-3"} style={{ minHeight: compact ? 40 : 56 }}>
        {compact ? null : (
          <div className="flex flex-wrap gap-1 mb-2" style={{ minHeight: 20 }}>
            {game.tags.map((tag) => {
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={cn("truncate font-medium", compact ? "text-xs" : "text-sm")}>{game.name}</h3>
            {!compact && <p className="mt-1 text-xs text-gray-500">{game.platform}</p>}
          </div>
          {onEditTags && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light"
              onClick={(e) => { e.stopPropagation(); onEditTags(); }} title="Edit tags">
              <Tag className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-400"
            onClick={() => onDelete(game.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
