import { memo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Game } from "@/types/game";
import { Play, Trash2, Monitor, Tag, Download, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tagColor";
import { steamCdnFallbacks, steamLandscapeFallbacks, extractSteamAppId } from "@/lib/steamCdn";
import { convertFileSrc } from "@tauri-apps/api/core";
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

/** Resolve a cover path (local filesystem path or CDN URL) to a displayable image src. */
function resolveCoverSrc(path: string): string | null {
  if (!path) return null;
  if (/^(https?:|data:|blob:|asset:)/.test(path)) return path;
  try { return convertFileSrc(path); } catch { return null; }
}

interface GameCardProps {
  game: Game;
  onDelete: (id: string) => void;
  onLaunch: (game: Game) => void;
  onEditTags?: () => void;
  compact?: boolean;
  horizontal?: boolean;
  favorited?: boolean;
  onToggleFav?: () => void;
}

export default memo(function GameCard({ game, onDelete, onLaunch, onEditTags, compact, horizontal, favorited, onToggleFav }: GameCardProps) {
  const { t } = useTranslation();
  const [coverSrc, setCoverSrc] = useState<string>("");
  const [landscapeSrc, setLandscapeSrc] = useState<string>("");
  const uninstalled = game.installed === false;

  // ── Portrait cover (grid modes) ──
  useEffect(() => {
    let cancelled = false;
    if (game.coverPath) {
      const localSrc = resolveCoverSrc(game.coverPath);
      if (localSrc) { setCoverSrc(localSrc); return; }
      const urls = steamCdnFallbacks(game.coverPath);
      const tryNext = (i: number) => {
        if (cancelled) return;
        if (i >= urls.length) {
          if (!uninstalled && game.executablePath && !game.executablePath.startsWith("steam://")) {
            getExeIcon(game.executablePath).then((url) => { if (!cancelled && url) setCoverSrc(url); });
          }
          return;
        }
        const img = new Image();
        img.onload = () => { if (!cancelled) setCoverSrc(urls[i]); };
        img.onerror = () => tryNext(i + 1);
        img.src = urls[i];
      };
      tryNext(0);
      return () => { cancelled = true; };
    }
    if (!game.executablePath) return;
    getExeIcon(game.executablePath).then((url) => {
      if (!cancelled && url) setCoverSrc(url);
    });
    return () => { cancelled = true; };
  }, [game.executablePath, game.coverPath, uninstalled]);

  // ── Landscape cover (horizontal mode) ──
  useEffect(() => {
    if (!horizontal) { setLandscapeSrc(""); return; }
    let cancelled = false;
    const localSrc = resolveCoverSrc(game.landscapePath);
    if (localSrc) { setLandscapeSrc(localSrc); return; }
    const appId = extractSteamAppId(game.id);
    if (appId) {
      const urls = steamLandscapeFallbacks(appId);
      const tryNext = (i: number) => {
        if (cancelled) return;
        if (i >= urls.length) return;
        const img = new Image();
        img.onload = () => { if (!cancelled) setLandscapeSrc(urls[i]); };
        img.onerror = () => tryNext(i + 1);
        img.src = urls[i];
      };
      tryNext(0);
    }
    return () => { cancelled = true; };
  }, [game.landscapePath, game.id, horizontal]);

  // ── Horizontal landscape card ──
  if (horizontal) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-surface-lighter border border-primary/10 hover:border-primary/30 transition-all duration-300 cursor-pointer group"
        onClick={() => onLaunch(game)}>
        {/* Landscape banner */}
        <div className="relative aspect-[2.4/1] overflow-hidden bg-surface-lighter">
          <FavoriteStar active={!!favorited} onToggle={onToggleFav || (() => {})} />
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-lighter to-surface">
            {landscapeSrc ? (
              <img src={landscapeSrc} alt={game.name} className="h-full w-full object-cover" />
            ) : (
              <Monitor className="h-12 w-12 text-gray-600" />
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
            <Button size="icon" className="h-12 w-12 rounded-full opacity-0 transition-all group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onLaunch(game); }}>
              {uninstalled ? <Download className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
            </Button>
          </div>
        </div>
        {/* Info row */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-200 truncate">{game.name}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{uninstalled ? t("game.steam_uninstalled") : game.platform}</span>
              {game.tags && game.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {game.tags.map((tag) => {
                    const c = tagColor(tag);
                    return <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border" style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.fg + "40" }}>{tag}</span>;
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onToggleFav && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-yellow-400"
                onClick={(e) => { e.stopPropagation(); onToggleFav(); }}>
                <Star className={cn("h-4 w-4", favorited ? "fill-yellow-400 text-yellow-400" : "")} />
              </Button>
            )}
            {onEditTags && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light"
                onClick={(e) => { e.stopPropagation(); onEditTags(); }}>
                <Tag className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(game.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Portrait card (grid modes) ──
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

        {!compact && <p className="text-xs text-gray-500 mb-2">{uninstalled ? t("game.steam_uninstalled") : game.platform}</p>}

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
