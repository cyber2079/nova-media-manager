import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";

export default function FavoriteStar({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="absolute top-2 right-2 z-10"
      title={active ? "Remove from favorites" : "Add to favorites"} aria-label={active ? "Unfavorite" : "Favorite"}>
      <NeonIcon name="Star" size={16}><Star className={cn(
        "h-5 w-5 transition-all duration-200 drop-shadow-md",
        active
          ? "fill-yellow-400 text-yellow-400"
          : "text-[var(--color-primary-light)]/40 hover:text-[var(--color-primary-light)]/80"
      )} /></NeonIcon>
    </button>
  );
}
