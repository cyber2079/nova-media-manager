import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useTranslation } from "react-i18next";
import GameCard from "@/components/GameCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TagFilterBar from "@/components/TagFilterBar";
import TagEditDialog from "@/components/TagEditDialog";
import { useBatchSelect } from "@/lib/useBatchSelect";
import { useSearchJump } from "@/lib/searchJump";
import ConfirmDialog from '@/components/ConfirmDialog';
import BatchBar from "@/components/BatchBar";
import BatchCheckbox from "@/components/BatchCheckbox";
import { useContextMenu } from "@/lib/useContextMenu";
import DropZone from "@/components/DropZone";
import { cn } from "@/lib/utils";
import { useFavoritesStore } from "@/stores/favoritesStore";
import { tagColor } from "@/lib/tagColor";
import { Upload, Gamepad2, Loader2, Star, Play, Monitor, Trash2, Tag, Search, X, CheckSquare } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import LayoutSwitch, { type LayoutMode } from "@/components/LayoutSwitch";
import { useLayoutMode } from "@/lib/useLayoutMode";
import PaginationBar from "@/components/PaginationBar";
import { usePagination } from "@/lib/usePagination";
import { useToast } from "@/components/Toast";
import type { Game } from "@/types/game";

export default function GameLibrary() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { games, isLoading, loadGames, addGame, deleteGame, launchGame, updateTags, scanSteam, isScanning, scanResult, scanDiagnostic } = useGameStore();
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const { getByType, toggleFavorite, isFavorite } = useFavoritesStore();
  const [favOnly, setFavOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [tagEditItem, setTagEditItem] = useState<Game | null>(null);
  const [layoutMode, setLayoutMode] = useLayoutMode("layout-games", "list");
  const { onContext, menu } = useContextMenu();

  useEffect(() => { loadGames(); }, []);

  const confirmThen = (msg, fn) => setConfirmDelete({ msg, onOk: fn });

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
    let r = activeTags.length ? games.filter((g) => activeTags.some((t) => g.tags?.includes(t))) : games;
    if (favOnly) { const ids = new Set(getByType("game")); r = r.filter((g) => ids.has(g.id)); }
    if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter((g) => g.name.toLowerCase().includes(q)); }
    return r;
  }, [games, activeTags, favOnly, getByType, searchQuery]);

  const pageSize = layoutMode === "small" ? 30 : 20;
  const { page, setPage, totalPages, paginated } = usePagination(filtered, pageSize);
  useSearchJump(filtered, pageSize, setPage);

  const allIds = useMemo(() => paginated.map((g) => g.id), [paginated]);
  const batch = useBatchSelect(allIds);

  const allTags = useMemo(() => {
    const tc = new Map<string, number>();
    games.forEach((g) => g.tags?.forEach((t) => tc.set(t, (tc.get(t)||0)+1)));
    return Array.from(tc.entries()).sort((a,b) => b[1]-a[1]);
  }, [games]);

  const tagNames = useMemo(() => allTags.map(([tag]) => tag), [allTags]);

  const handleDropImport = useCallback(async (paths: string[]) => { for (const p of paths) await addGame(p); }, [addGame]);

  const handleAddGame = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, filters: [{ name: "Executable", extensions: ["exe","lnk","app","sh","desktop"] }] });
      if (selected) await addGame(selected as string);
    } catch (e) { console.error("addGame failed:", e); toast("添加游戏失败", "error"); }
  }, [addGame]);

  const handleBatchDelete = useCallback(() => {
    confirmThen(t("game.confirm_batch_delete", { n: batch.selected.size }), async () => {
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
        <h1 className="font-bold text-2xl transition-all duration-500">{t("game.title")}</h1>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input placeholder={t("game.search", "搜索游戏...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-7" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5"><X className="h-3.5 w-3.5" /></button>}
        </div>
        {scanResult && (
          <span className="text-xs text-primary-light/80">{scanResult}</span>
        )}
        <button onClick={scanSteam} disabled={isScanning}
          className={cn("h-8 w-8 rounded-md border transition-colors flex items-center justify-center",
            "border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50")}
          title="扫描 Steam 游戏">
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
        <button onClick={() => setFavOnly((v) => !v)} className={cn("h-8 w-8 rounded-md border transition-colors flex items-center justify-center", favOnly ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400" : "border-primary text-gray-500 hover:border-yellow-400/30 hover:text-yellow-400")}><Star className="h-4 w-4" /></button>
        <Button onClick={handleAddGame} className="h-8 w-8 p-0" title={t("game.add")}><Upload className="h-4 w-4" /></Button>
        {!batch.showCheckboxes ? (
          <Button variant="outline" onClick={batch.enterBatchMode} className="h-8 w-8 p-0" title={t("batch.enter")}><CheckSquare className="h-4 w-4" /></Button>
        ) : (
          <Button variant="outline" onClick={batch.leaveBatchMode} className="h-8 w-8 p-0" title={t("batch.exit")}><X className="h-4 w-4" /></Button>
        )}
        <LayoutSwitch mode={layoutMode} onChange={setLayoutMode} />
      </div>
      <TagFilterBar tags={allTags} activeTags={activeTags} onToggle={(tag) => setActiveTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag])} onClear={() => setActiveTags([])} t={t} />

      {/* Scan diagnostic log */}
      {scanDiagnostic.length > 0 && (
        <div className="rounded-lg border p-3 text-xs font-mono space-y-0.5 max-h-48 overflow-y-auto relative border-primary/20 bg-primary/5 text-primary-light/80">
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <span className="text-xs font-bold tabular-nums text-primary-light">
              {diagCountdown > 0 ? `${diagCountdown}s` : ""}
            </span>
            <button
              onClick={dismissDiag}
              className="h-5 w-5 flex items-center justify-center rounded transition-colors text-primary-light/60 hover:text-primary-light hover:bg-primary-light/20"
              title="关闭"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {scanDiagnostic.map((line, i) => (
            <div key={i} className="pr-16">{line}</div>
          ))}
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-light" /></div>}
      {filtered.length > 0 ? (
        <>
          {layoutMode === "list" ? (
            <div className="flex flex-col gap-1">
              {paginated.map((game) => (
                <div key={game.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-lighter transition-colors cursor-pointer group"
                  onClick={() => { if (batch.showCheckboxes) { batch.toggle(game.id); return; } launchGame(game.id); }}
                  onContextMenu={(e: React.MouseEvent) => onContext(e, game.executablePath)}>
                  {batch.showCheckboxes && <BatchCheckbox inline checked={batch.selected.has(game.id)} onToggle={() => batch.toggle(game.id)} />}
                  <GameIcon path={game.executablePath} />
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
                      <Star className={cn("h-4 w-4", getByType("game").includes(game.id) ? "fill-yellow-400 text-yellow-400" : "")} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setTagEditItem(game); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-light hover:bg-surface-lighter/50 transition-colors">
                      <Tag className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); launchGame(game.id); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
                      <Play className="h-4 w-4 ml-0.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); confirmThen(t("game.confirm_delete"), () => deleteGame(game.id)); }}
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
              {paginated.map((game) => (
                <div key={game.id} className="relative group" onContextMenu={(e: React.MouseEvent) => onContext(e, game.executablePath)}
                  onClick={() => { if (batch.showCheckboxes) batch.toggle(game.id); }}>
                  {batch.showCheckboxes && <BatchCheckbox checked={batch.selected.has(game.id)} onToggle={() => batch.toggle(game.id)} />}
                  <GameCard game={game} onDelete={(id) => confirmThen(t("game.confirm_delete"), () => deleteGame(id))} onLaunch={batch.showCheckboxes ? () => {} : (_g) => launchGame(_g.id)} onEditTags={() => setTagEditItem(game)} compact={layoutMode === "small"} favorited={isFavorite(game.id)} onToggleFav={() => toggleFavorite(game.id, "game")} />
                </div>
              ))}
            </div>
          )}
          <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
        </>
      ) : !isLoading && (
        <EmptyState icon={<Gamepad2 className="h-16 w-16" />} title={t("game.no_games")} hint={t("game.no_games_hint")} />
      )}
      {tagEditItem && (
        <TagEditDialog open={true} onClose={() => setTagEditItem(null)} itemName={tagEditItem.name} tags={tagEditItem.tags || []} allTags={tagNames} onSave={(ts) => updateTags(tagEditItem.id, ts)} t={t} />
      )}
      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.msg || ""} onConfirm={() => { confirmDelete?.onOk(); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} />
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

function GameIcon({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (!path) return;
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
  }, [path]);

  return (
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-transparent shrink-0 flex items-center justify-center" style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-contain" style={{ imageRendering: "auto" }} />
      ) : (
        <Monitor className="h-5 w-5 text-gray-500" />
      )}
    </div>
  );
}
