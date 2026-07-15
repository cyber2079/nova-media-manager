import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/SafeImage";
import type { ImageItem } from "@/types/image";
import { Trash2, Image as ImageIcon, Tag, Monitor } from "lucide-react";
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
  favorited?: boolean;
  onToggleFav?: () => void;
}

export default memo(function ImageCard({ image, onDelete, onClick, onEditTags, onSetWallpaper, compact, favorited, onToggleFav }: ImageCardProps) {

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
        <div className="flex items-center gap-1">
          {onSetWallpaper && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light"
              onClick={(e) => { e.stopPropagation(); onSetWallpaper(image.filePath); }} title="设为壁纸">
              <Monitor className="h-3.5 w-3.5" />
            </Button>
          )}
          {onEditTags && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-primary-light"
              onClick={(e) => { e.stopPropagation(); onEditTags(); }} title="Edit tags">
              <Tag className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
