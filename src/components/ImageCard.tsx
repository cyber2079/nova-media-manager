import { useTranslation } from "react-i18next";
import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/SafeImage";
import type { ImageItem } from "@/types/image";
import { Trash2, Image as ImageIcon, Tag, Monitor } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { cn, formatFileSize } from "@/lib/utils";
import { tagColor } from "@/lib/tagColor";
import FavoriteStar from "@/components/FavoriteStar";

interface ImageCardProps {
  image: ImageItem;
  onDelete: (id: string) => void;
  onClick?: () => void;
  onEditTags?: () => void;
  onSetWallpaper?: (path: string) => void;
  compact?: boolean;
  horizontal?: boolean;
  favorited?: boolean;
  onToggleFav?: () => void;
}

export default memo(function ImageCard({ image, onDelete, onClick, onEditTags, onSetWallpaper, compact, horizontal, favorited, onToggleFav }: ImageCardProps) {
  const { t } = useTranslation();

  // ── Horizontal banner layout ──
  if (horizontal) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-surface-lighter border border-primary/10 hover:border-primary/30 transition-all duration-300 cursor-pointer group"
        onClick={onClick}>
        <div className="relative aspect-[2.4/1] overflow-hidden bg-surface-lighter">
          <FavoriteStar active={!!favorited} onToggle={onToggleFav || (() => {})} />
          <SafeImage src={image.coverPath} alt={image.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            fallback={<div className="flex h-full items-center justify-center"><NeonIcon name="Image" size={16}><ImageIcon className="h-12 w-12 text-gray-600" /></NeonIcon></div>} />
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-200 truncate">{image.name}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{image.resolution} · {formatFileSize(image.fileSize)}</span>
              {image.tags && image.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {image.tags.slice(0, 3).map((tag) => {
                    const c = tagColor(tag);
                    return <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border" style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.fg + "40" }}>{tag}</span>;
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onSetWallpaper && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onSetWallpaper(image.filePath); }} title={t("image.set_wallpaper")}>
                <NeonIcon name="Monitor" size={16}><Monitor className="h-3.5 w-3.5" /></NeonIcon>
              </Button>
            )}
            {onEditTags && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEditTags(); }} title={t("image.edit_tags")}>
                <NeonIcon name="Tag" size={16}><Tag className="h-3.5 w-3.5" /></NeonIcon>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/70 hover:text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(image.id); }} title={t("image.confirm_delete")}>
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
      className="group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] theme-enter-card cursor-pointer hover:shadow-xl hover:shadow-primary/10"
      onClick={onClick}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-lighter">
        <FavoriteStar active={!!favorited} onToggle={onToggleFav || (() => {})} />
        <SafeImage
          src={image.coverPath}
          alt={image.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          fallback={
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="h-12 w-12 text-gray-600" />
            </div>
          }
        />

        <div className="absolute top-2 left-2 flex flex-wrap gap-1" />

      </div>

      <CardContent className={compact ? "p-2" : "p-3"}>
        {compact ? null : (
          <div className="flex flex-wrap gap-1 mb-2" style={{ minHeight: 20 }}>
            {image.tags.map((tag) => {
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
        <h3 className={cn("truncate font-medium mb-1.5", compact ? "text-xs" : "text-sm")}>{image.name}</h3>

        {/* 信息行 */}
        {!compact && <p className="text-xs text-gray-500 mb-2">
          {image.resolution} · {formatFileSize(image.fileSize)}
        </p>}

        {/* 操作按钮行 */}
        <div className="flex items-center gap-0.5">
          {onSetWallpaper && (
            <button
              className={cn("flex items-center justify-center rounded-md text-gray-500 hover:text-primary-light hover:bg-white/5 transition-colors",
                compact ? "h-6 w-6" : "h-8 w-8")}
              onClick={(e) => { e.stopPropagation(); onSetWallpaper(image.filePath); }} title={t("image.set_wallpaper")}>
              <NeonIcon name="Monitor" size={16}><Monitor className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /></NeonIcon>
            </button>
          )}
          {onEditTags && (
            <button className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:text-primary-light hover:bg-white/5 transition-colors"
              onClick={(e) => { e.stopPropagation(); onEditTags(); }} title="Edit tags">
              <NeonIcon name="Tag" size={16}><Tag className="h-3.5 w-3.5" /></NeonIcon>
            </button>
          )}
          <div className="flex-1" />
          <button className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}>
            <NeonIcon name="Trash2" size={16}><Trash2 className="h-4 w-4" /></NeonIcon>
          </button>
        </div>
      </CardContent>
    </Card>
  );
});
