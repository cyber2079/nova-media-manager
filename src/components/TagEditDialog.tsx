import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, X } from "lucide-react";

interface TagEditDialogProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  tags: string[];
  allTags?: string[];
  onSave: (tags: string[]) => void;
  t: (key: string) => string;
}

export default function TagEditDialog({ open, onClose, itemName, tags, allTags, onSave, t }: TagEditDialogProps) {
  const [newTag, setNewTag] = useState("");
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!allTags) return [];
    return allTags.filter((s) => !localTags.includes(s) && s.toLowerCase().includes(newTag.toLowerCase())).slice(0, 5);
  }, [allTags, localTags, newTag]);

  const addTag = (v?: string) => {
    const val = (v || newTag).trim();
    if (!val || localTags.includes(val)) return;
    const updated = [...localTags, val];
    setLocalTags(updated);
    onSave(updated);
    setNewTag("");
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    const updated = localTags.filter((t) => t !== tag);
    setLocalTags(updated);
    onSave(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("movie.edit_tags")} - {itemName}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {localTags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/20 px-2.5 py-0.5 text-xs text-primary-light transition-all hover:scale-105 cursor-pointer"
              onClick={() => removeTag(tag)}>
              {tag} <X className="h-3 w-3" />
            </span>
          ))}
        </div>
        <div className="relative flex gap-2 mt-3">
          <div className="flex-1 relative">
            <Input placeholder={t("movie.new_tag")} value={newTag}
              onChange={(e) => { setNewTag(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => e.key === "Enter" && addTag()} />
            {showSuggestions && newTag && suggestions.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-surface-light border border-primary rounded-md shadow-xl z-50 overflow-hidden">
                {suggestions.map((s) => (
                  <button key={s} type="button" className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-lighter hover:text-white transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); addTag(s); }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={() => addTag()} size="sm"><Tag className="h-4 w-4 mr-1" />{t("movie.add_tag")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
