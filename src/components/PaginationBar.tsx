import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

export default memo(function PaginationBar({ page, totalPages, onPage }: PaginationBarProps) {
  if (totalPages <= 1) return null;

  // Build page number buttons: always show first, last, and pages around current
  const pages: (number | "...")[] = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 py-6 animate-fade-in-up">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-surface-lighter disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <NeonIcon name="ChevronLeft" size={16}><ChevronLeft className="h-4 w-4" /></NeonIcon>
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dot-${i}`} className="w-8 text-center text-gray-600 text-xs">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`h-8 w-8 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
              p === page
                ? "bg-primary/20 text-primary-light"
                : "text-gray-400 hover:text-white hover:bg-surface-lighter"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-surface-lighter disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <NeonIcon name="ChevronRight" size={16}><ChevronRight className="h-4 w-4" /></NeonIcon>
      </button>
    </div>
  );
}
)