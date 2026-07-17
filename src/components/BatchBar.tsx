import { CheckSquare, ListPlus, Trash2, Tag, X, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import TagEditDialog from "@/components/TagEditDialog";

interface BatchBarProps {
  selected: string[];
  selectAll: () => void;
  clear: () => void;
  invert: () => void;
  onDelete: () => void;
  allTags: string[]; // existing tag names for autocomplete
  onBatchTag: (tags: string[]) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  onAddToPlaylist?: () => void; // if provided, show "add to playlist" button
}

export default function BatchBar({ selected, selectAll, clear, invert, onDelete, allTags, onBatchTag, t, onAddToPlaylist }: BatchBarProps) {
  const [tagOpen, setTagOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-surface-light/95 backdrop-blur-md border border-primary rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
        <span className="text-sm text-white font-medium">{t("batch.selected_count", { n: selected.length })}</span>
        <div className="w-px h-5 bg-primary/30" />
        <button onClick={selectAll} className="flex items-center gap-1.5 text-xs text-primary-light hover:text-white transition-colors">
          <CheckSquare className="h-3.5 w-3.5" />{t("batch.select_all")}
        </button>
        <button onClick={invert} className="flex items-center gap-1.5 text-xs text-primary-light hover:text-white transition-colors">
          <ArrowLeftRight className="h-3.5 w-3.5" />{t("batch.invert")}
        </button>
        {onAddToPlaylist && (
          <button onClick={onAddToPlaylist} className="flex items-center gap-1.5 text-xs text-primary-light hover:text-white transition-colors">
            <ListPlus className="h-3.5 w-3.5" />{t("music.batch_add_to_playlist")}
          </button>
        )}
        <button onClick={() => setTagOpen(true)} className="flex items-center gap-1.5 text-xs text-primary-light hover:text-white transition-colors">
          <Tag className="h-3.5 w-3.5" />{t("batch.batch_tags")}
        </button>
        <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-primary-light hover:text-red-400 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />{t("batch.batch_delete")}
        </button>
        <div className="w-px h-5 bg-primary/30" />
        <button onClick={clear} className="flex items-center gap-1 text-xs text-primary-light hover:text-white transition-colors">
          <X className="h-3.5 w-3.5" />{t("batch.cancel")}
        </button>
      </div>

      {tagOpen && (
        <TagEditDialog open={true} onClose={() => setTagOpen(false)}
          itemName={`${selected.length}${t("batch.items_suffix")}`} tags={[]}
          allTags={allTags}
          onSave={(tags) => { onBatchTag(tags); setTagOpen(false); }} t={t} />
      )}
    </>
  );
}
