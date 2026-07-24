import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMovieStore } from "@/stores/movieStore";
import { useImageStore } from "@/stores/imageStore";
import { useMusicStore } from "@/stores/musicStore";
import { useGameStore } from "@/stores/gameStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useNavigate } from "react-router-dom";
import { setSearchJumpTarget } from "@/lib/searchJump";
import { useTranslation } from "react-i18next";
import { Video, Image, Music, Gamepad2, Search } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string; name: string; subtitle: string; type: "movie" | "image" | "music" | "game";
}

const typeMeta = {
  movie: { icon: Video, color: "#e06040", label: "movie.title" as const, path: "/movies", pageKey: "movies" },
  image: { icon: Image, color: "#4488ff", label: "image.title" as const, path: "/images", pageKey: "images" },
  music: { icon: Music, color: "#5b8c5a", label: "music.title" as const, path: "/music", pageKey: "music" },
  game: { icon: Gamepad2, color: "#d4a84b", label: "game.title" as const, path: "/games", pageKey: "games" },
};

export default function GlobalSearch({ open: externalOpen, onClose }: { open?: boolean; onClose?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => { setInternalOpen(v); if (!v) onClose?.(); };
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const movies = useMovieStore((s) => s.movies);
  const images = useImageStore((s) => s.images);
  const music = useMusicStore((s) => s.music);
  const games = useGameStore((s) => s.games);

  // Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setInternalOpen((o) => !o);
        setQuery(""); setSelected(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sync external open
  useEffect(() => {
    if (externalOpen) { setInternalOpen(true); setQuery(""); setSelected(0); }
  }, [externalOpen]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const items: SearchResult[] = [];
    movies.forEach((m) => { if (m.name.toLowerCase().includes(q)) items.push({ id: m.id, name: m.name, subtitle: m.duration || "", type: "movie" }); });
    images.forEach((i) => { if (i.name.toLowerCase().includes(q)) items.push({ id: i.id, name: i.name, subtitle: i.resolution || "", type: "image" }); });
    music.forEach((m) => { if (m.name.toLowerCase().includes(q) || m.artist.toLowerCase().includes(q)) items.push({ id: m.id, name: m.name, subtitle: m.artist, type: "music" }); });
    games.forEach((g) => { if (g.name.toLowerCase().includes(q)) items.push({ id: g.id, name: g.name, subtitle: g.platform || "", type: "game" }); });
    return items.slice(0, 20);
  }, [query, movies, images, music, games]);

  const goTo = useCallback((item: SearchResult) => {
    setSearchJumpTarget(item.id);
    // Pre-set store search so the library shows the item on page 1
    if (item.type === "movie") useMovieStore.getState().setSearchQuery(item.name);
    if (item.type === "music") useMusicStore.getState().setSearchQuery(item.name);
    // Ensure target page content is visible (not minimized)
    const pageKey = typeMeta[item.type].pageKey;
    const s = useSettingsStore.getState();
    if (s.contentMinimized[pageKey]) s.toggleContentMinimized(pageKey);
    navigate(typeMeta[item.type].path);
    setOpen(false);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") {
      if (results[selected]) goTo(results[selected]);
    } else if (e.key === "Escape") { setOpen(false); }
  }, [results, selected, goTo]);

  const grouped = useMemo(() => {
    const g: Record<string, SearchResult[]> = { movie: [], image: [], music: [], game: [] };
    results.forEach((r) => g[r.type].push(r));
    return g;
  }, [results]);

  let idx = 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-white/5" style={{ background: "color-mix(in srgb, var(--color-primary) 6%, rgba(8,12,20,0.94))" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <NeonIcon name="Search" size={16}><Search className="h-4 w-4 text-gray-500 shrink-0" /></NeonIcon>
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder={t("search.placeholder")}
            className="border-0 bg-transparent h-auto p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-gray-600"
          />
        </div>

        {query && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-600">{t("search.no_results")}</div>
        )}

        {!query && (
          <div className="px-4 py-8 text-center text-sm text-gray-600">
            {t("search.hint")}
          </div>
        )}

        {query && results.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {(["movie", "image", "music", "game"] as const).map((type) => {
              const items = grouped[type];
              if (items.length === 0) return null;
              const meta = typeMeta[type];
              const Icon = meta.icon;
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-surface-lighter/50">
                    <Icon className="h-3 w-3" style={{ color: meta.color }} />
                    {t(meta.label)}
                  </div>
                  {items.map((item) => {
                    const sel = selected === idx; idx++;
                    return (
                      <button
                        key={item.id}
                        className={cn(
                          "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors",
                          sel ? "bg-primary/10" : "hover:bg-surface-lighter/50"
                        )}
                        onClick={() => goTo(item)}
                        onMouseEnter={() => setSelected(idx - 1)}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-white truncate">{item.name}</span>
                          {item.subtitle && <span className="block text-xs text-gray-500 truncate">{item.subtitle}</span>}
                        </span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", sel ? "bg-primary/20 text-primary-light" : "text-gray-600")}>
                          {t(meta.label)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
