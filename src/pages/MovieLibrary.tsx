import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useMovieStore } from "@/stores/movieStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeStore } from "@/stores/themeStore";
import MovieCard from "@/components/MovieCard";
import EmptyState from "@/components/EmptyState";
import SafeImage from "@/components/SafeImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, Video, Tag, Play, Pause, Clock, Maximize, Trash2, X, Star, CheckSquare } from "lucide-react";
import TagFilterBar from "@/components/TagFilterBar";
import TagEditDialog from "@/components/TagEditDialog";
import LayoutSwitch, { type LayoutMode } from "@/components/LayoutSwitch";
import { useLayoutMode } from "@/lib/useLayoutMode";
import PaginationBar from "@/components/PaginationBar";
import { usePagination } from "@/lib/usePagination";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { Movie } from "@/types/movie";
import { useFavoritesStore } from "@/stores/favoritesStore";
import { tagColor } from "@/lib/tagColor";
import { useBatchSelect } from "@/lib/useBatchSelect";
import { useSearchJump } from "@/lib/searchJump";
import BatchCheckbox from "@/components/BatchCheckbox";
import ConfirmDialog from '@/components/ConfirmDialog';
import BatchBar from "@/components/BatchBar";

export default function MovieLibrary() {
  const { t } = useTranslation();
  const {
    movies, isLoading, searchQuery, activeTags, sortConfig,
    loadMovies, addMovies, deleteMovie, setSearchQuery, toggleTag, setSortConfig, updateMovie, updateMovieTags,
  } = useMovieStore();

  const [layoutMode, setLayoutMode] = useLayoutMode("layout-movies", "card");
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [tagDialogMovie, setTagDialogMovie] = useState<Movie | null>(null);
  const [tagEditItem, setTagEditItem] = useState<Movie | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ msg: string; onOk: () => void } | null>(null);
  const confirmThen = (msg: string, fn: () => void) => setConfirmDelete({ msg, onOk: fn });

  const handleSetWallpaper = useCallback((filePath: string) => {
    useSettingsStore.getState().setWallpaperConfig({ mode: "single", path: filePath });
    useThemeStore.getState().setTheme("default");
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadMovies();
    const setupListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        listen<Movie>("movie-updated", (event) => {
          updateMovie(event.payload);
        });
      } catch { /* not in Tauri */ }
    };
    setupListener();
  }, []);

  const filteredMovies = useMemo(() => {
    let result = [...movies];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q));
    }
    if (activeTags.length > 0) {
      result = result.filter((m) => activeTags.some((t) => m.tags.includes(t)));
    }
    switch (sortConfig) {
      case "nameAsc": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "nameDesc": result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "durationAsc": result.sort((a, b) => a.durationSeconds - b.durationSeconds); break;
      case "durationDesc": result.sort((a, b) => b.durationSeconds - a.durationSeconds); break;
    }
    return result;
  }, [movies, searchQuery, activeTags, sortConfig]);

  const allIds = useMemo(() => filteredMovies.map(m => m.id), [filteredMovies]);
  const batch = useBatchSelect(allIds);
  const { toggleFavorite, isFavorite } = useFavoritesStore();

  const pageSize = layoutMode === "small" ? 30 : 20;
  const { page, setPage, totalPages, paginated } = usePagination(filteredMovies, pageSize);
  useSearchJump(filteredMovies, pageSize, setPage);

  const allTags = useMemo(() => {
    const tagCount = new Map<string, number>();
    movies.forEach((m) => m.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
    return Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [movies]);

  const tagNames = useMemo(() => allTags.map(([tag]) => tag), [allTags]);

  const handleAddMovies = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: true,
        filters: [{ name: "Video", extensions: ["mp4", "avi", "mov", "mkv", "flv", "wmv", "webm"] }],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await addMovies(paths);
      }
    } catch {
      alert("Please run in Tauri desktop environment");
    }
  }, [addMovies]);

  const [loadingVideo, setLoadingVideo] = useState(false);

  const handlePlayMovie = async (movie: Movie) => {
    setPlayingMovie(movie);
    setLoadingVideo(true);
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      // Determine MIME type from extension
      const ext = (movie.filePath.split(".").pop() || "mp4").toLowerCase();
      const mimeMap: Record<string, string> = {
        mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
        avi: "video/x-msvideo", mkv: "video/x-matroska", flv: "video/x-flv",
        wmv: "video/x-ms-wmv", m4v: "video/mp4",
      };
      const mimeType = mimeMap[ext] || "video/mp4";

      const data = await readFile(movie.filePath);
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      setVideoSrc(url);
    } catch (e) {
      console.error("Failed to read video:", e);
    }
    setLoadingVideo(false);
  };

  const handleBatchDelete = useCallback(() => {
    confirmThen(t("movie.confirm_batch_delete", { n: batch.selected.size }), async () => {
      for (const id of batch.selected) { await deleteMovie(id); }
      batch.clear();
    });
  }, [batch, deleteMovie, t]);

  const handleBatchTag = useCallback(async (tags: string[]) => {
    for (const id of batch.selected) { await updateMovieTags(id, tags); }
    batch.clear();
  }, [batch, updateMovieTags]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-bold text-2xl transition-all duration-500">
          {t("movie.title")}
        </h1>
        <div className="flex-1" />
        <div className="relative w-64">
          <Input placeholder={t("movie.search")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-7" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button onClick={handleAddMovies} className="gap-2"><Upload className="h-4 w-4" />{t("movie.add")}</Button>
        {!batch.showCheckboxes ? (
          <Button variant="outline" size="sm" onClick={batch.enterBatchMode} className="gap-1.5 text-xs">
            <CheckSquare className="h-3.5 w-3.5" />
            {t("batch.enter")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={batch.leaveBatchMode} className="gap-1.5 text-xs">
            <X className="h-3.5 w-3.5" />
            {t("batch.exit")}
          </Button>
        )}
        <LayoutSwitch mode={layoutMode} onChange={setLayoutMode} />
      </div>

      <TagFilterBar tags={allTags} activeTags={activeTags} onToggle={toggleTag}
        onClear={() => useMovieStore.setState({ activeTags: [] })} t={t} />

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span>{t("movie.sort_label")}</span>
        {[t("movie.sort_default"), t("movie.sort_name_asc"), t("movie.sort_name_desc"), t("movie.sort_duration_asc"), t("movie.sort_duration_desc")].map((label, i) => {
          const values = ["default", "nameAsc", "nameDesc", "durationAsc", "durationDesc"];
          return (
            <button key={i} onClick={() => setSortConfig(values[i])}
              className={"rounded px-2 py-1 transition-colors hover:text-white " + (sortConfig === values[i] ? "bg-surface-lighter text-white" : "")}>
              {label}
            </button>
          );
        })}
      </div>

      {isLoading && movies.length === 0 && (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-light" /></div>
      )}

      {filteredMovies.length > 0 ? (
        <>
          {layoutMode === "list" ? (
            <div className="flex flex-col gap-1">
              {paginated.map((movie) => (
                <div key={movie.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-lighter transition-colors cursor-pointer group"
                  onClick={() => { if (batch.showCheckboxes) { batch.toggle(movie.id); return; } handlePlayMovie(movie); }}>
                  {batch.showCheckboxes && <BatchCheckbox inline checked={batch.selected.has(movie.id)} onToggle={() => batch.toggle(movie.id)} />}
                  <div className="w-10 h-14 rounded overflow-hidden bg-surface-lighter shrink-0">
                    <SafeImage src={movie.coverPath} alt={movie.name} className="w-full h-full object-cover"
                      fallback={<div className="flex h-full items-center justify-center"><Play className="h-4 w-4 text-gray-600" /></div>} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{movie.name}</p>
                    <p className="text-xs text-gray-500">{movie.duration}{movie.resolution ? ` · ${movie.resolution}` : ""}</p>
                    {movie.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {movie.tags.map((tag) => {
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
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(movie.id, "movie"); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-surface-lighter/50 transition-colors">
                      <Star className={cn("h-4 w-4", isFavorite(movie.id) ? "fill-yellow-400 text-yellow-400" : "")} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setTagEditItem(movie); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-light hover:bg-surface-lighter/50 transition-colors">
                      <Tag className="h-4 w-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handlePlayMovie(movie); }}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
                    <Play className="h-4 w-4 ml-0.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); confirmThen(t("movie.confirm_delete"), () => deleteMovie(movie.id)); }}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-surface-lighter/50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={layoutMode === "card"
              ? "grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid gap-3 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"}>
              {paginated.map((movie) => (
                <div key={movie.id} className="relative group"
                  onClick={() => { if (batch.showCheckboxes) batch.toggle(movie.id); }}>
                  {batch.showCheckboxes && <BatchCheckbox checked={batch.selected.has(movie.id)} onToggle={() => batch.toggle(movie.id)} />}
                  <MovieCard movie={movie} onDelete={(id) => confirmThen(t("movie.confirm_delete"), () => deleteMovie(id))} onPlay={batch.showCheckboxes ? () => {} : handlePlayMovie} onSetWallpaper={handleSetWallpaper} onEditTags={() => setTagDialogMovie(movie)} compact={layoutMode === "small"} favorited={isFavorite(movie.id)} onToggleFav={() => toggleFavorite(movie.id, "movie")} />
                </div>
              ))}
            </div>
          )}
          <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
        </>
      ) : (
        <EmptyState icon={<Video className="h-16 w-16" />} title={t("movie.no_movies")} hint={t("movie.no_movies_hint")} />
      )}

      <Dialog open={!!playingMovie} onOpenChange={(open) => { if (!open) { setPlayingMovie(null); URL.revokeObjectURL(videoSrc); setVideoSrc(""); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{playingMovie?.name}</DialogTitle></DialogHeader>
          {playingMovie && loadingVideo && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary-light" />
            </div>
          )}
          {playingMovie && !loadingVideo && videoSrc && (
            <div className="relative group">
              <video ref={videoRef} controls autoPlay className="w-full rounded-lg" style={{ maxHeight: "70vh" }}
                src={videoSrc} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {tagDialogMovie && (
        <TagEditDialog open={true} onClose={() => setTagDialogMovie(null)} itemName={tagDialogMovie.name}
          tags={tagDialogMovie.tags} onSave={(tags) => updateMovieTags(tagDialogMovie.id, tags)} t={t} />
      )}

      {tagEditItem && (
        <TagEditDialog open={true} onClose={() => setTagEditItem(null)} itemName={tagEditItem.name}
          tags={tagEditItem.tags} allTags={tagNames} onSave={(tags) => updateMovieTags(tagEditItem.id, tags)} t={t} />
      )}

      {batch.showCheckboxes && <BatchBar selected={Array.from(batch.selected)} selectAll={batch.selectAll} clear={batch.leaveBatchMode} invert={batch.invert} onDelete={handleBatchDelete} allTags={tagNames} onBatchTag={handleBatchTag} t={t} />}
      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.msg || ""} onConfirm={() => { confirmDelete?.onOk(); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
