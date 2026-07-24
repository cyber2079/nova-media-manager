import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useGameStore, type ScanResultMsg } from "@/stores/gameStore";
import { useTranslation } from "react-i18next";
import GameCard from "@/components/GameCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TagFilterBar from "@/components/TagFilterBar";
import TagEditDialog from "@/components/TagEditDialog";
import { useBatchSelect } from "@/lib/useBatchSelect";
import { useSearchJump } from "@/lib/searchJump";
import { useConfirmStore } from "@/stores/confirmStore";
import BatchBar from "@/components/BatchBar";
import BatchCheckbox from "@/components/BatchCheckbox";
import { useContextMenu } from "@/lib/useContextMenu";
import DropZone from "@/components/DropZone";
import { cn } from "@/lib/utils";
import { useFavoritesStore } from "@/stores/favoritesStore";
import { tagColor } from "@/lib/tagColor";
import { Upload, Gamepad2, Loader2, Star, Play, Monitor, Trash2, Tag, Search, X, CheckSquare } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import CountBadge from "@/components/CountBadge";
import EmptyState from "@/components/EmptyState";
import LayoutSwitch, { type LayoutMode } from "@/components/LayoutSwitch";
import SortBar, { useNameSortOptions, useSortAnim } from "@/components/SortBar";
import { useLayoutMode } from "@/lib/useLayoutMode";
import PaginationBar from "@/components/PaginationBar";
import { usePagination } from "@/lib/usePagination";
import { useToast } from "@/components/Toast";
import { useAllTags } from "@/hooks/useAllTags";
import { steamCdnFallbacks } from "@/lib/steamCdn";
import type { Game } from "@/types/game";

export default function GameLibrary() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { games, isLoading, isImporting, sortConfig, loadGames, addGame, deleteGame, launchGame, updateTags, scanSteam, isScanning, scanResult, scanDiagnostic, setSortConfig } = useGameStore();
  const sortOptions = useNameSortOptions();
  const { triggerSort } = useSortAnim();
  const handleSort = useCallback((key: string) => triggerSort(() => setSortConfig(key)), [triggerSort, setSortConfig]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const { getByType, toggleFavorite, isFavorite } = useFavoritesStore();
  const [favOnly, setFavOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagEditItem, setTagEditItem] = useState<Game | null>(null);
  const confirm = useConfirmStore((s) => s.confirm);
  const [layoutMode, setLayoutMode] = useLayoutMode("layout-games", "list");
  const { onContext, menu } = useContextMenu();

  useEffect(() => { loadGames(); }, []);

  // Auto-clear scan result
  useEffect(() => {
    if (!scanResult) return;
    const t = setTimeout(() => useGameStore.setState({ scanResult: null }), 4000);
    return () => clearTimeout(t);
  }, [scanResult]);

  // Countdown for scan diagnostic log
  const [diagCountdown, setDiagCountdown] = useState(0);
  useEffect(() => {
    if (scanDiagnostic.length === 0) { setDiagCountdown(0); return; }
    setDiagCountdown(5);
    const interval = setInterval(() => {
      setDiagCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          queueMicrotask(() => useGameStore.setState({ scanDiagnostic: [] }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [scanDiagnostic]);

  const dismissDiag = useCallback(() => {
    useGameStore.setState({ scanDiagnostic: [] });
  }, []);

  const filtered = useMemo(() => {
    let r = activeTags.length ? games.filter((g) => activeTags.some((t) => g.tags?.includes(t))) : [...games];
    if (favOnly) { const ids = new Set(getByType("game")); r = r.filter((g) => ids.has(g.id)); }
    if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter((g) => g.name.toLowerCase().includes(q)); }
    if (sortConfig === "nameAsc") r.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortConfig === "nameDesc") r.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortConfig === "dateAsc") r.sort((a, b) => new Date(a.addTime).getTime() - new Date(b.addTime).getTime());
    else if (sortConfig === "dateDesc") r.sort((a, b) => new Date(b.addTime).getTime() - new Date(a.addTime).getTime());
    return r;
  }, [games, activeTags, favOnly, getByType, searchQuery, sortConfig]);

  const pageSize = layoutMode === "banner" ? 10 : layoutMode === "small" ? 30 : 20;
  const { page, setPage, totalPages, paginated } = usePagination(filtered, pageSize);
  useSearchJump(filtered, pageSize, setPage);

  const allIds = useMemo(() => paginated.map((g) => g.id), [paginated]);
  const batch = useBatchSelect(allIds);

  const [allTags, tagNames] = useAllTags(games);

  const handleDropImport = useCallback(async (paths: string[]) => { for (const p of paths) await addGame(p); }, [addGame]);

  const handleAddGame = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, filters: [{ name: "Executable", extensions: ["exe","lnk","app","sh","desktop"] }] });
      if (selected) await addGame(selected as string);
    } catch (e) { console.error("addGame failed:", e); toast(t("game.add_failed"), "error"); }
  }, [addGame]);

  const handleBatchDelete = useCallback(() => {
    confirm(t("game.confirm_batch_delete", { n: batch.selected.size }), async () => {
      for (const id of batch.selected) { await deleteGame(id); }
      batch.clear();
    });
  }, [batch, deleteGame, t]);

  const handleBatchTag = useCallback(async (tags: string[]) => {
    for (const id of batch.selected) { await updateTags(id, tags); }
    batch.clear();
  }, [batch, updateTags]);

  return (
    <>
    <DropZone onDrop={handleDropImport} accept={".exe,.lnk,.app,.sh,.desktop,.bat,.cmd,.com"}>
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-4">
        <h1 className="font-bold text-2xl transition-all duration-500 relative">{t("game.title")}<CountBadge n={games.length} /></h1>
        <div className="flex-1" />
        <div className="relative w-64">
          <Input placeholder={t("game.search")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-7" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5"><NeonIcon name="X" size={16}><X className="h-3.5 w-3.5" /></NeonIcon></button>}
        </div>
        {scanResult && (
          <span className="text-xs text-primary-light/80">
            {scanResult.type === "found" ? t("game.scan_found", { count: scanResult.count })
              : scanResult.type === "none" ? t("game.scan_none")
              : t("game.scan_failed", { error: scanResult.error })}
          </span>
        )}
        <button onClick={scanSteam} disabled={isScanning}
          className={cn("h-8 w-8 rounded-md border transition-colors flex items-center justify-center",
            "border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50")}
          title={t("game.scan_steam")}>
          {isScanning ? <NeonIcon name="Loader2" size={16}><Loader2 className="h-4 w-4 animate-spin" /></NeonIcon> : <NeonIcon name="Gamepad2" size={16}><Gamepad2 className="h-4 w-4" /></NeonIcon>}
        </button>
        <button onClick={() => setFavOnly((v) => !v)} className={cn("h-8 w-8 rounded-md border transition-colors flex items-center justify-center", favOnly ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400" : "border-primary text-gray-500 hover:border-yellow-400/30 hover:text-yellow-400")}><NeonIcon name="Star" size={16}><Star className="h-4 w-4" /></NeonIcon></button>
        <Button onClick={handleAddGame} className="h-8 w-8 p-0" title={t("game.add")}><NeonIcon name="Upload" size={16}><Upload className="h-4 w-4" /></NeonIcon></Button>
        {!batch.showCheckboxes ? (
          <Button variant="outline" onClick={batch.enterBatchMode} className="h-8 w-8 p-0" title={t("batch.enter")}><NeonIcon name="CheckSquare" size={16}><CheckSquare className="h-4 w-4" /></NeonIcon></Button>
        ) : (
          <Button variant="outline" onClick={batch.leaveBatchMode} className="h-8 w-8 p-0" title={t("batch.exit")}><NeonIcon name="X" size={16}><X className="h-4 w-4" /></NeonIcon></Button>
        )}
        <LayoutSwitch mode={layoutMode} onChange={setLayoutMode} />
      </div>
      <TagFilterBar tags={allTags} activeTags={activeTags} onToggle={(tag) => setActiveTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag])} onClear={() => setActiveTags([])} t={t} />
      <SortBar options={sortOptions} active={sortConfig} onChange={handleSort} className="mb-2" />

      {/* Scan diagnostic log */}
      {scanDiagnostic.length > 0 && (
        <div className="rounded-lg border p-3 text-xs font-mono space-y-0.5 max-h-80 overflow-y-auto relative border-primary/20 bg-primary/5 text-primary-light/80 select-text cursor-text">
          <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
            <button
              onClick={dismissDiag}
              className="h-5 w-5 flex items-center justify-center rounded transition-colors text-primary-light/60 hover:text-primary-light hover:bg-primary-light/20"
              title={t("game.close")}
            >
              <NeonIcon name="X" size={16}><X className="h-3 w-3" /></NeonIcon>
            </button>
          </div>
          {scanDiagnostic.map((line, i) => (
            <div key={i} className="pr-12">{line}</div>
          ))}
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center py-20"><NeonIcon name="Loader2" size={16}><Loader2 className="h-8 w-8 animate-spin text-primary-light" /></NeonIcon></div>}
      {filtered.length > 0 ? (
        <>
          {layoutMode === "banner" ? (
            <div className={cn("flex flex-col gap-3")}>
              {paginated.map((game) => (
                <motion.div layout key={game.id} className="relative group"
                  onContextMenu={(e: React.MouseEvent) => onContext(e, game.executablePath)}
                  onClick={() => { if (batch.showCheckboxes) { batch.toggle(game.id); return; } launchGame(game.id); }}>
                  {batch.showCheckboxes && <BatchCheckbox checked={batch.selected.has(game.id)} onToggle={() => batch.toggle(game.id)} />}
                  <GameCard
                    game={game}
                    onDelete={(id) => confirm(t("game.confirm_delete"), () => deleteGame(id))}
                    onLaunch={batch.showCheckboxes ? () => {} : (_g) => launchGame(_g.id)}
                    onEditTags={() => setTagEditItem(game)}
                    horizontal
                    favorited={isFavorite(game.id)}
                    onToggleFav={() => toggleFavorite(game.id, "game")}
                  />
                </motion.div>
              ))}
            </div>
          ) : layoutMode === "list" ? (
            <div className={cn("flex flex-col gap-1")}>
              {paginated.map((game) => (
                <motion.div layout key={game.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-lighter transition-colors cursor-pointer group"
                  onClick={() => { if (batch.showCheckboxes) { batch.toggle(game.id); return; } launchGame(game.id); }}
                  onContextMenu={(e: React.MouseEvent) => onContext(e, game.executablePath)}>
                  {batch.showCheckboxes && <BatchCheckbox inline checked={batch.selected.has(game.id)} onToggle={() => batch.toggle(game.id)} />}
                  <GameIcon path={game.executablePath} coverPath={game.coverPath} installed={game.installed} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-gray-200 truncate">{game.name}</p>
                    </div>
                    <p className="text-xs text-gray-500">{game.platform}</p>
                    {game.tags && game.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {game.tags.map((tag) => {
                          const c = tagColor(tag);
                          return <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.bg, color: c.fg }}>{tag}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(game.id, "game"); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-surface-lighter/50 transition-colors">
                      <NeonIcon name="Star" size={16}><Star className={cn("h-4 w-4", getByType("game").includes(game.id) ? "fill-yellow-400 text-yellow-400" : "")} /></NeonIcon>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setTagEditItem(game); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-light hover:bg-surface-lighter/50 transition-colors">
                      <NeonIcon name="Tag" size={16}><Tag className="h-4 w-4" /></NeonIcon>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); launchGame(game.id); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
                      <NeonIcon name="Play" size={16}><Play className="h-4 w-4 ml-0.5" /></NeonIcon>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); confirm(t("game.confirm_delete"), () => deleteGame(game.id)); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-surface-lighter/50 transition-colors">
                      <NeonIcon name="Trash2" size={16}><Trash2 className="h-4 w-4" /></NeonIcon>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className={cn(layoutMode === "card"
              ? "grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid gap-3 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10")}>
              {paginated.map((game) => (
                <motion.div layout key={game.id} className="relative group" onContextMenu={(e: React.MouseEvent) => onContext(e, game.executablePath)}
                  onClick={() => { if (batch.showCheckboxes) batch.toggle(game.id); }}>
                  {batch.showCheckboxes && <BatchCheckbox checked={batch.selected.has(game.id)} onToggle={() => batch.toggle(game.id)} />}
                  <GameCard game={game} onDelete={(id) => confirm(t("game.confirm_delete"), () => deleteGame(id))} onLaunch={batch.showCheckboxes ? () => {} : (_g) => launchGame(_g.id)} onEditTags={() => setTagEditItem(game)} compact={layoutMode === "small"} favorited={isFavorite(game.id)} onToggleFav={() => toggleFavorite(game.id, "game")} />
                </motion.div>
              ))}
            </div>
          )}
          <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
        </>
      ) : !isLoading && (
        <EmptyState icon={<NeonIcon name="Gamepad2" size={16}><Gamepad2 className="h-16 w-16" /></NeonIcon>} title={t("game.no_games")} hint={t("game.no_games_hint")} />
      )}
      {tagEditItem && (
        <TagEditDialog open={true} onClose={() => setTagEditItem(null)} itemName={tagEditItem.name} tags={tagEditItem.tags || []} allTags={tagNames} onSave={(ts) => updateTags(tagEditItem.id, ts)} t={t} />
      )}
    </div>
    </DropZone>
    {menu}
    {batch.showCheckboxes && (
      <BatchBar selected={Array.from(batch.selected)} selectAll={batch.selectAll} clear={batch.leaveBatchMode} invert={batch.invert}
        onDelete={handleBatchDelete} allTags={tagNames} onBatchTag={handleBatchTag} t={t} />
    )}
    </>
  );
}

// ── GameIcon: extracts .exe icon inline (cached) ──
const gameIconCache = new Map<string, string>();

function GameIcon({ path, coverPath, installed }: { path: string; coverPath?: string; installed?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    // Steam games: try CDN variants in order, then fall back to exe icon
    if (coverPath) {
      const urls = steamCdnFallbacks(coverPath);
      const tryNext = (i: number) => {
        if (cancelledRef.current) return;
        if (i >= urls.length) {
          // All CDN variants exhausted — try exe icon
          if (path && !path.startsWith("steam://")) {
            const cached = gameIconCache.get(path);
            if (cached) { setSrc(cached); return; }
            (async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                const dataUrl: string = await invoke("extract_exe_icon", { path });
                if (!cancelledRef.current && dataUrl) {
                  gameIconCache.set(path, dataUrl);
                  setSrc(dataUrl);
                }
              } catch {}
            })();
          }
          return;
        }
        const img = new Image();
        img.onload = () => { if (!cancelledRef.current) setSrc(urls[i]); };
        img.onerror = () => tryNext(i + 1);
        img.src = urls[i];
      };
      tryNext(0);
      return;
    }
    // Non-Steam games: try exe icon
    if (!path || path.startsWith("steam://")) return;
    const cached = gameIconCache.get(path);
    if (cached) { setSrc(cached); return; }

    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const dataUrl: string = await invoke("extract_exe_icon", { path });
        if (!cancelledRef.current && dataUrl) {
          gameIconCache.set(path, dataUrl);
          setSrc(dataUrl);
        }
      } catch {}
    })();

    return () => { cancelledRef.current = true; };
  }, [path, coverPath, installed]);

  return (
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-transparent shrink-0 flex items-center justify-center" style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-contain" style={{ imageRendering: "auto" }} />
      ) : (
        <NeonIcon name="Monitor" size={16}><Monitor className="h-5 w-5 text-gray-500" /></NeonIcon>
      )}
    </div>
  );
}
