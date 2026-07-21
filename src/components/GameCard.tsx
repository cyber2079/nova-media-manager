import { memo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Game } from "@/types/game";
import { Play, Trash2, Monitor, Tag, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tagColor";
import FavoriteStar from "@/components/FavoriteStar";

const iconCache = new Map<string, string>();

async function getExeIcon(path: string): Promise<string | null> {
  if (!path || path.startsWith("steam://")) return null;
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
  const uninstalled = game.installed === false;

  // Load exe icon or Steam CDN cover
  useEffect(() => {
    if (uninstalled) {
      if (game.coverPath) {
        // Preload cover from URL; if it loads use it, otherwise try exe icon
        const img = new Image();
        img.onload = () => setCoverSrc(game.coverPath);
        img.src = game.coverPath;
      }
      return;
    }
    if (!game.executablePath) return;
    let cancelled = false;
    getExeIcon(game.executablePath).then((url) => {
      if (!cancelled && url) setCoverSrc(url);
    });
    return () => { cancelled = true; };
  }, [game.executablePath, game.coverPath, uninstalled]);

  return (
    <Card
      className={cn("group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] theme-enter-card cursor-pointer")}
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

        {/* Uninstalled badge */}
        {uninstalled && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 border border-white/10 text-[10px] text-gray-400">
            未安装
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
          <Button size="icon" className="h-12 w-12 rounded-full opacity-0 transition-all group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onLaunch(game); }}>
            {uninstalled ? <Download className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
          </Button>
        </div>

      </div>

      <CardContent className={compact ? "p-2" : "p-3"}>
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

        <h3 className={cn("truncate font-medium mb-1.5", compact ? "text-xs" : "text-sm")}>{game.name}</h3>

        {!compact && <p className="text-xs text-gray-500 mb-2">{uninstalled ? "Steam · 未安装" : game.platform}</p>}

        <div className="flex items-center gap-1">
          {onEditTags && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light"
              onClick={(e) => { e.stopPropagation(); onEditTags(); }} title="Edit tags">
              <Tag className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); onDelete(game.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
