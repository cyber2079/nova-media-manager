import { memo } from "react";
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f59e0b",
  "#10b981","#06b6d4","#3b82f6","#f97316","#84cc16",
];

function hashColor(tag: string) {
  let h = 0; for(let i=0;i<tag.length;i++) h = tag.charCodeAt(i) + ((h<<5)-h);
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

interface TagFilterBarProps {
  tags: [string, number][];
  activeTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
  t: (key: string) => string;
}

export default memo(function TagFilterBar({ tags, activeTags, onToggle, onClear, t }: TagFilterBarProps) {
  if (!tags.length) return null;

  return (
    <div className="flex flex-nowrap items-center gap-1.5 animate-fade-in-up overflow-x-auto pb-1">
      <button
        onClick={onClear}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium border transition-all duration-200",
          activeTags.length === 0
            ? "bg-primary/20 border-primary/30 text-primary-light"
            : "border-primary text-gray-400 hover:bg-primary/10 hover:text-white"
        )}
      >
        {t("movie.all_tags")}
      </button>
      {tags.map(([tag, count]) => {
        const active = activeTags.includes(tag);
        const color = hashColor(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-all duration-200 hover:scale-105",
              active
                ? "text-white shadow-sm"
                : "text-primary-light/70 hover:text-primary-light border-primary/30 hover:border-primary/60"
            )}
            style={active ? { backgroundColor: color + "30", borderColor: color, color } : {}}
          >
            {tag}
            <span className="ml-1 opacity-60">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
)