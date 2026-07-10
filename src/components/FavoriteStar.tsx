import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export default function FavoriteStar({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="absolute top-2 left-2 z-10"
      title={active ? "Remove from favorites" : "Add to favorites"} aria-label={active ? "Unfavorite" : "Favorite"}>
      <Star className={cn("h-5 w-5 transition-all duration-200 drop-shadow-md", active ? "fill-yellow-400 text-yellow-400" : "text-white/60 hover:text-yellow-300")} />
    </button>
  );
}
