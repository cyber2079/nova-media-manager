import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface BatchCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  show?: boolean; // always show when in batch mode
  inline?: boolean; // non-absolute layout for list rows
}

export default function BatchCheckbox({ checked, onToggle, show, inline }: BatchCheckboxProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={cn(
        "flex items-center justify-center transition-all duration-200",
        inline
          ? "h-5 w-5 rounded border-2 shrink-0"
          : "absolute top-2 right-2 z-10 h-5 w-5 rounded border-2",
        checked
          ? "bg-primary border-primary text-white"
          : "border-white/40 bg-black/30 hover:border-white/70",
        show === false && !checked && !inline && "opacity-0 group-hover:opacity-100"
      )}
      aria-label={checked ? "Deselect" : "Select"}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  );
}
