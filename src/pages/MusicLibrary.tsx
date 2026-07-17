import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useMusicStore } from "@/stores/musicStore";
import { useAudioPlayerStore, fmtTime, getAudio } from "@/stores/audioPlayerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { getMusicCoverFallback, musicCoverSrc } from "@/lib/musicCoverFallback";
import MusicCard from "@/components/MusicCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Music, Loader2, Pause, Play, SkipBack, SkipForward, Star, ListPlus, ListMusic, Trash2, X, ChevronLeft, Minimize2, Plus, Search, Volume2, VolumeX, Type, Tag, CheckSquare, Palette } from "lucide-react";
import PlayModeControls from "@/components/PlayModeControls";
import TagFilterBar from "@/components/TagFilterBar";
import TagEditDialog from "@/components/TagEditDialog";
import { useBatchSelect } from "@/lib/useBatchSelect";
import { useSearchJump } from "@/lib/searchJump";
import BatchBar from "@/components/BatchBar";
import BatchCheckbox from "@/components/BatchCheckbox";
import DropZone from "@/components/DropZone";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tagColor";
import { useFavoritesStore } from "@/stores/favoritesStore";
import { usePlayHistoryStore } from "@/stores/playHistoryStore";
import { useTranslation } from "react-i18next";
import EmptyState from "@/components/EmptyState";
import Lyrics from "@/components/Lyrics";
import LayoutSwitch, { type LayoutMode } from "@/components/LayoutSwitch";
import { useLayoutMode } from "@/lib/useLayoutMode";
import PaginationBar from "@/components/PaginationBar";
import { usePagination } from "@/lib/usePagination";
import { useToast } from "@/components/Toast";
import { importMediaPaths, pickFolderAndImport, importSummaryText } from "@/lib/mediaScan";
import { FolderOpen } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { usePlaylistStore } from "@/stores/playlistStore";
import type { Music as MusicType } from "@/types/music";
import { AudioMotionAnalyzer } from "audiomotion-analyzer";

// 模块级单例 — 跨路由 remount 保持，避免重复 createMediaElementSource
let _motion: AudioMotionAnalyzer | null = null;
let _motionInited = false;

export default function MusicLibrary() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { music, isLoading, searchQuery, activeTags, loadMusic, addMusic, deleteMusic, setSearchQuery, toggleTag, setActiveTags, updateTags } = useMusicStore();
  const { getByType, toggleFavorite, isFavorite } = useFavoritesStore();
  const { playlists, create, remove, addSong, addSongs, removeSong, removeSongs } = usePlaylistStore();
  // Granular selectors — avoid 60fps visualizerBars re-rendering entire page
  const track = useAudioPlayerStore((s) => s.track);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const currentTime = useAudioPlayerStore((s) => s.currentTime);
  const duration = useAudioPlayerStore((s) => s.duration);
  const volume = useAudioPlayerStore((s) => s.volume);
  const isBackground = useAudioPlayerStore((s) => s.isBackground);
  const playbackSourceLabel = useAudioPlayerStore((s) => s.playbackSourceLabel);
  const play = useAudioPlayerStore((s) => s.play);
  const toggle = useAudioPlayerStore((s) => s.toggle);
  const stop = useAudioPlayerStore((s) => s.stop);
  const seek = useAudioPlayerStore((s) => s.seek);
  const setVolume = useAudioPlayerStore((s) => s.setVolume);
  const setBackground = useAudioPlayerStore((s) => s.setBackground);
  const lyricFontSize = useSettingsStore((s) => s.lyricFontSize);
  const setLyricFontSize = useSettingsStore((s) => s.setLyricFontSize);
  const visualizerMode = useSettingsStore((s) => s.visualizerMode);
  const setVisualizerMode = useSettingsStore((s) => s.setVisualizerMode);
  const playerBgColor = useSettingsStore((s) => s.playerBgColor);
  const setPlayerBgColor = useSettingsStore((s) => s.setPlayerBgColor);
  const playerBgMode = useSettingsStore((s) => s.playerBgMode);
  const playerBgCustom = playerBgMode === "custom";
  const [favOnly, setFavOnly] = useState(false);
  const [layoutMode, setLayoutMode] = useLayoutMode("layout-music", "list");
  const [tagEditItem, setTagEditItem] = useState<MusicType | null>(null);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // playlistContext: when set, handleNext/handlePrev iterate this array instead of filtered grid
  const [playlistContext, setPlaylistContext] = useState<string[] | null>(null);
  // batch select within playlist detail
  const [plBatch, setPlBatch] = useState<Set<string>>(new Set());
  // batch-add-to-playlist picker
  const [batchPlaylistOpen, setBatchPlaylistOpen] = useState(false);
  // add songs to playlist modal
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [addSongBatch, setAddSongBatch] = useState<Set<string>>(new Set());
  const [addSongSearch, setAddSongSearch] = useState("");
  // playlist rename
  const [renamePlId, setRenamePlId] = useState<string | null>(null);
  const [renamePlName, setRenamePlName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ msg: string; onOk: () => void } | null>(null);

  // ── audioMotion 频谱分析器（只输出数据，不渲染画布） ──
  const vizCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vizCanvasRef.current || _motionInited) return;
    _motionInited = true;
    const audioEl = getAudio();

    _motion = new AudioMotionAnalyzer(vizCanvasRef.current, {
      source: audioEl,
      fftSize: 1024,
      mode: 0,
      smoothing: 0.42,
      minDecibels: -80,
      maxDecibels: -12,
      bgAlpha: 0,
      showScaleX: false,
      showScaleY: false,
      showBgColor: false,
      overlay: false,
      start: true,
    });

    _motion.onCanvasDraw = (inst) => {
      const raw = inst.getBars();
      const clean = raw.map((b: { value: number }) => (isFinite(b.value) ? b.value : 0.01));
      useAudioPlayerStore.setState({ visualizerBars: clean });
    };

    const visibilityHandler = () => {
      if (_motion) document.hidden ? _motion.toggleAnalyzer(false) : _motion.toggleAnalyzer(true);
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []);

  // 离开音乐页暂停频谱，回来恢复
  useEffect(() => {
    if (_motion) _motion.toggleAnalyzer(true);
    return () => {
      _motion?.toggleAnalyzer(false);
      useAudioPlayerStore.setState({ visualizerBars: new Array(32).fill(0.01) });
    };
  }, []);

  useEffect(() => { loadMusic(); }, []);

  // Clear background flag when on music page
  useEffect(() => { setBackground(false); }, []);

  const confirmThen = (msg: string, fn: () => void) => setConfirmDelete({ msg, onOk: fn });

  const filtered = useMemo(() => {
    let result = [...music];
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter((m) => m.name.toLowerCase().includes(q) || m.artist.toLowerCase().includes(q) || m.album.toLowerCase().includes(q)); }
    if (favOnly) { const ids = new Set(getByType("music")); result = result.filter((m) => ids.has(m.id)); }
    if (activeTags.length > 0) { result = result.filter((m) => activeTags.some((t) => m.tags.includes(t))); }
    return result;
  }, [music, searchQuery, activeTags, favOnly, getByType]);

  const pageSize = layoutMode === "small" ? 30 : 20;
  const { page, setPage, totalPages, paginated } = usePagination(filtered, pageSize);
  useSearchJump(filtered, pageSize, setPage);

  const allIds = useMemo(() => filtered.map((x) => x.id), [filtered]);
  const batch = useBatchSelect(allIds);

  const allTags = useMemo(() => {
    const tc = new Map<string, number>();
    music.forEach((m) => m.tags.forEach((t) => tc.set(t, (tc.get(t) || 0) + 1)));
    return Array.from(tc.entries()).sort((a, b) => b[1] - a[1]);
  }, [music]);

  const tagNames = useMemo(() => allTags.map(([tag]) => tag), [allTags]);

  // 拖入的可能是文件或文件夹 — Rust 自动识别、递归展开、与库去重
  const handleDropImport = useCallback(async (paths: string[]) => {
    try {
      const r = await importMediaPaths(paths, "music");
      toast(importSummaryText(r, "首"), r.added > 0 ? "success" : "info");
    } catch { await addMusic(paths); }
  }, [addMusic]);

  const handleAdd = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true, filters: [{ name: "Music", extensions: ["mp3", "flac", "wav", "m4a", "ogg", "wma", "aac"] }] });
      if (selected) { const paths = Array.isArray(selected) ? selected : [selected]; await addMusic(paths); }
    } catch { toast(t("music.toast_tauri_only"), "error"); }
  }, [addMusic]);

  const handleAddFolder = useCallback(async () => {
    try {
      const r = await pickFolderAndImport("music");
      if (r) toast(importSummaryText(r, "首"), r.added > 0 ? "success" : "info");
    } catch { toast(t("music.toast_tauri_only"), "error"); }
  }, []);

  const handleBatchDelete = useCallback(() => {
    confirmThen(t("music.confirm_batch_delete", { n: batch.selected.size }), async () => {
      for (const id of batch.selected) { await deleteMusic(id); }
      batch.clear();
    });
  }, [batch, deleteMusic, t]);

  const handleBatchTag = useCallback(async (tags: string[]) => {
    for (const id of batch.selected) { await updateTags(id, tags); }
    batch.clear();
  }, [batch, updateTags]);

  const handlePlay = useCallback(async (m: MusicType, forceRestart?: boolean) => {
    // In repeat-one mode: same track = restart from beginning, not toggle
    if (track?.id === m.id && !forceRestart) { toggle(); return; }
    usePlayHistoryStore.getState().record({ id: m.id, name: m.name, type: "music", time: new Date().toISOString() });
    await play(m);
  }, [track, toggle, play]);

  // Push source to store ONLY on explicit play actions.
  // Uses getState() (not hook) because handlePlay sets {track} synchronously
  // but the hook hasn't re-rendered yet.
  const syncSource = useCallback((ctx: string[] | null) => {
    if (!useAudioPlayerStore.getState().track) return;
    const source = ctx ?? filtered.map((m) => m.id);
    let id = "";
    let label = t("music.title");
    if (ctx) {
      const pl = playlists.find((p) => p.musicIds === ctx);
      if (pl) { id = pl.id; label = pl.name; }
    }
    useAudioPlayerStore.getState().setPlaybackSource(source, id, label);
  }, [filtered, playlists]);

  // Play from grid — always resets source to "音乐库"
  const handleGridPlay = useCallback((m: MusicType) => {
    handlePlay(m);
    if (playlistContext) setPlaylistContext(null);
    syncSource(null);
  }, [handlePlay, playlistContext, syncSource]);

  // Play from playlist detail — switches source to that playlist
  const handlePlaylistPlay = useCallback((m: MusicType, plMusicIds: string[]) => {
    handlePlay(m);
    if (playlistContext !== plMusicIds) setPlaylistContext(plMusicIds);
    syncSource(plMusicIds);
  }, [handlePlay, playlistContext, syncSource]);

  // ── Playlist helpers ──
  const musicMap = useMemo(() => {
    const m = new Map<string, MusicType>(); music.forEach((x) => m.set(x.id, x)); return m;
  }, [music]);

  // id→index Map — O(1) lookup instead of O(n) findIndex every render
  const playIndexMap = useMemo(() => {
    const source = playlistContext ?? filtered.map((m) => m.id);
    const m = new Map<string, number>();
    source.forEach((id, i) => m.set(id, i));
    return m;
  }, [filtered, playlistContext]);
  const playIndex = track ? (playIndexMap.get(track.id) ?? -1) : -1;
  const handlePrev = useCallback(() => {
    const source = playlistContext ?? filtered.map((m) => m.id);
    if (source.length === 0) return;
    const idx = playIndex > 0 ? playIndex - 1 : source.length - 1;
    const m = musicMap.get(source[idx]);
    if (m) handlePlay(m, true);
  }, [filtered, playlistContext, playIndex, handlePlay, musicMap]);
  // Manual next — always advance, never repeat current. getNextSong only used by auto-ended callback.
  const handleNext = useCallback(() => {
    const source = playlistContext ?? filtered.map((m) => m.id);
    if (source.length === 0) return;
    const nextIdx = playIndex >= source.length - 1 ? 0 : playIndex + 1;
    const m = musicMap.get(source[nextIdx]);
    if (m) handlePlay(m, true);
  }, [filtered, playlistContext, playIndex, handlePlay, musicMap]);

  // Sync playback source to the store so mini-player prev/next + auto-advance
  // work after navigating away.
  const { playMode } = usePlaylistStore();

  // Recovery: on mount, if store says we're playing from a playlist but local
  // state was reset (page navigation), restore the playlist view.
  useEffect(() => {
    const storedId = useAudioPlayerStore.getState().playbackSourceId;
    if (storedId && !playlistContext) {
      const pl = playlists.find((p) => p.id === storedId);
      if (pl) {
        setPlaylistContext(pl.musicIds);
        setSelectedPlaylist(pl.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  // Push source to store ONLY on explicit play actions — never reactively.
  // ── Progress seeking ──
  const seekTo = useCallback((clientX: number) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seek(pct);
  }, [duration, seek]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => { setSeeking(true); seekTo(e.clientX); }, [seekTo]);

  useEffect(() => {
    if (!seeking) return;
    const onMove = (e: MouseEvent) => seekTo(e.clientX);
    const onUp = () => setSeeking(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [seeking, seekTo]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const selectedPlData = useMemo(() => {
    if (!selectedPlaylist) return null;
    return playlists.find((p) => p.id === selectedPlaylist) || null;
  }, [playlists, selectedPlaylist]);

  // Songs NOT yet in the current playlist (for the "add to playlist" picker)
  const songsToAdd = useMemo(() => {
    if (!selectedPlData) return [];
    const inPlaylist = new Set(selectedPlData.musicIds);
    let result = music.filter((m) => !inPlaylist.has(m.id));
    if (addSongSearch) {
      const q = addSongSearch.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q) || m.artist.toLowerCase().includes(q));
    }
    return result;
  }, [music, selectedPlData, addSongSearch]);

  const playing = track;

  return (
    <>
    <DropZone onDrop={handleDropImport} accept={".mp3,.flac,.wav,.m4a,.ogg,.wma,.aac"} allowFolders>
      <div ref={vizCanvasRef} style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }} />
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-bold text-2xl transition-all duration-500">
          {showPlaylists ? t("music.playlists") : t("music.title")}
        </h1>
        <div className="flex-1" />
        {showPlaylists ? (
          <Button variant="ghost" onClick={() => { setShowPlaylists(false); setSelectedPlaylist(null); setPlaylistContext(null); setPlBatch(new Set()); }} className="gap-1.5 text-sm">
            <ChevronLeft className="h-4 w-4" />{t("music.hide_playlists")}
          </Button>
        ) : (
          <>
            <div className="relative w-64">
              <Input placeholder={t("music.search")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-7" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button onClick={() => setFavOnly((v) => !v)} className={cn("h-8 w-8 rounded-md border transition-colors flex items-center justify-center", favOnly ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400" : "border-primary text-gray-500 hover:border-yellow-400/30 hover:text-yellow-400")}><Star className="h-4 w-4" /></button>
            <button onClick={() => { setShowPlaylists(true); setSelectedPlaylist(playlists[0]?.id ?? null); }} className={cn("h-8 w-8 rounded-md border transition-colors flex items-center justify-center", "border-primary text-gray-500 hover:border-primary-light/30 hover:text-primary-light")} title={t("music.show_playlists")}><ListMusic className="h-4 w-4" /></button>
            <Button onClick={handleAdd} className="h-8 w-8 p-0" title={t("music.add")}><Upload className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={handleAddFolder} className="h-8 w-8 p-0" title="选择文件夹导入"><FolderOpen className="h-4 w-4" /></Button>
            {!batch.showCheckboxes ? (
              <Button variant="outline" onClick={batch.enterBatchMode} className="h-8 w-8 p-0" title={t("batch.enter")}><CheckSquare className="h-4 w-4" /></Button>
            ) : (
              <Button variant="outline" onClick={batch.leaveBatchMode} className="h-8 w-8 p-0" title={t("batch.exit")}><X className="h-4 w-4" /></Button>
            )}
            <LayoutSwitch mode={layoutMode} onChange={setLayoutMode} />
          </>
        )}
      </div>

      {!showPlaylists && (
        <TagFilterBar tags={allTags} activeTags={activeTags} onToggle={toggleTag} onClear={() => setActiveTags([])} t={t} />
      )}

      {/* ── Playlist view ── */}
      {showPlaylists && (
        <div className="flex gap-6 min-h-[60vh]">
          <div className="w-56 shrink-0 space-y-1">
            {playlists.length === 0 ? (
              <div className="text-center py-12">
                <ListMusic className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">{t("music.no_playlists")}</p>
                <p className="text-xs text-gray-600 mt-1">{t("music.no_playlists_hint")}</p>
              </div>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => setSelectedPlaylist(pl.id)}
                  onContextMenu={(e) => { e.preventDefault(); setRenamePlId(pl.id); setRenamePlName(pl.name); }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 flex items-center justify-between",
                    selectedPlaylist === pl.id
                      ? "bg-primary/15 text-primary-light"
                      : "text-gray-400 hover:bg-surface-lighter hover:text-gray-200"
                  )}
                >
                  <span className="truncate">{pl.name}</span>
                  <span className="text-[10px] opacity-50 shrink-0 ml-2">{pl.musicIds.length}</span>
                </button>
              ))
            )}
            <div className="pt-2">
              <Input placeholder={t("music.create_playlist")} className="h-8 text-xs"
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) { const pl = create((e.target as HTMLInputElement).value.trim()); setSelectedPlaylist(pl.id); (e.target as HTMLInputElement).value = ""; } }} />
              {renamePlId && (
                <div className="flex items-center gap-1 mt-2">
                  <Input
                    autoFocus
                    value={renamePlName}
                    onChange={(e) => setRenamePlName(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter" && renamePlName.trim()) {
                        usePlaylistStore.getState().rename(renamePlId!, renamePlName.trim());
                        setRenamePlId(null);
                      }
                      if (e.key === "Escape") setRenamePlId(null);
                    }}
                    onBlur={() => setRenamePlId(null)}
                    className="h-7 text-xs flex-1"
                  />
                  <button onClick={() => setRenamePlId(null)} className="text-gray-500 hover:text-white p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1">
            {!selectedPlData ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-600">{playlists.length > 0 ? t("music.select_playlist_hint") : ""}</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{selectedPlData.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{t("music.songs_count", { n: selectedPlData.musicIds.length })}</span>
                    {selectedPlData.musicIds.length > 0 && (
                      <button onClick={() => {
                        const ids = selectedPlData.musicIds;
                        const first = ids.find((id) => musicMap.has(id));
                        if (first) {
                          setPlaylistContext(ids);
                          handlePlay(musicMap.get(first)!);
                          const pl = playlists.find((p) => p.id === selectedPlData.id);
                          useAudioPlayerStore.getState().setPlaybackSource(ids, selectedPlData.id, pl?.name ?? t("music.playlists"));
                        }
                      }}
                        className="flex items-center gap-1 text-xs text-primary-light/70 hover:text-primary-light transition-colors px-2 py-1 rounded" title={t("music.play_all")}>
                        <Play className="h-3 w-3" />{t("music.play_all")}
                      </button>
                    )}
                    <button onClick={() => { setShowAddSongs(true); setAddSongBatch(new Set()); setAddSongSearch(""); }}
                      className="flex items-center gap-1 text-xs text-green-400/70 hover:text-green-400 transition-colors px-2 py-1 rounded" title={t("music.add_songs")}>
                      <Plus className="h-3 w-3" />{t("music.add_songs")}
                    </button>
                    {playlistContext && (
                      <button onClick={() => setPlaylistContext(null)}
                        className="flex items-center gap-1 text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors px-2 py-1 rounded" title={t("music.hide_playlists")}>
                        {t("music.playlist_playing")}
                      </button>
                    )}
                    <button onClick={() => confirmThen(t("music.confirm_delete_playlist"), () => { remove(selectedPlData.id); setSelectedPlaylist(null); setPlaylistContext(null); })}
                      className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors px-2 py-1 rounded" title={t("music.delete_playlist")}>
                      <Trash2 className="h-3 w-3" />{t("music.delete_playlist")}
                    </button>
                  </div>
                </div>

                {selectedPlData.musicIds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-sm text-gray-600 py-12">
                    <Music className="h-10 w-10 mb-3 opacity-40" />
                    <p>{t("music.empty_playlist")}</p>
                  </div>
                ) : (<>
                {/* batch remove bar in playlist */}
                {plBatch.size > 0 && (
                  <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                    <span className="text-white font-medium">{t("music.selected_count", { n: plBatch.size })}</span>
                    <button onClick={() => confirmThen(t("music.confirm_remove_songs", { n: plBatch.size }), () => { removeSongs(selectedPlData.id, Array.from(plBatch)); setPlBatch(new Set()); })}
                      className="text-red-400 hover:text-red-300 transition-colors">{t("music.remove_selected")}</button>
                    <button onClick={() => setPlBatch(new Set())} className="text-gray-500 hover:text-white transition-colors">{t("settings.cancel")}</button>
                  </div>
                )}
                {/* Batch select toggle button */}
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setPlBatch((prev) => prev.size > 0 ? new Set() : new Set(selectedPlData.musicIds.filter((id) => musicMap.has(id))))}
                    className="text-[11px] text-gray-500 hover:text-white transition-colors">
                    {plBatch.size > 0 ? t("music.cancel_select") : t("music.select_songs")}
                  </button>
                </div>
                <div className="space-y-1">
                  {selectedPlData.musicIds.map((id, idx) => {
                    const m = musicMap.get(id);
                    if (!m) return null;
                    const isPlBatch = plBatch.size > 0;
                    return (
                      <div key={id} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors duration-300 cursor-pointer border", playing?.id === m.id ? "bg-primary/10 border-primary/20" : "bg-transparent border-transparent hover:bg-surface-lighter")}
                        onDoubleClick={() => { if (!isPlBatch) handlePlaylistPlay(m, selectedPlData.musicIds); }}
                        onClick={() => {
                          if (!isPlBatch) return;
                          setPlBatch((prev) => {
                            const next = new Set(prev);
                            next.has(id) ? next.delete(id) : next.add(id);
                            return next;
                          });
                        }}>
                        {isPlBatch && (
                          <div className={cn("w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors", plBatch.has(id) ? "bg-primary border-primary text-white" : "border-primary")}>
                            {plBatch.has(id) && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        )}
                        {!isPlBatch && <span className="w-6 text-center text-[11px] text-gray-600 shrink-0">{idx + 1}</span>}
                        <div className="w-9 h-9 rounded overflow-hidden bg-surface-lighter shrink-0">
                          <img src={musicCoverSrc(m.coverPath)} alt="" className="w-full h-full object-cover object-top scale-125" onError={(e) => { (e.target as HTMLImageElement).src = getMusicCoverFallback(); }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm truncate", playing?.id === m.id ? "text-primary-light font-medium" : "text-gray-200")}>{m.name}</p>
                          <p className="text-xs text-gray-500 truncate">{m.artist}</p>
                        </div>
                        <span className="text-[10px] text-gray-600 shrink-0">{m.duration}</span>
                        {!isPlBatch && (
                          <>
                            <button onClick={() => handlePlaylistPlay(m, selectedPlData.musicIds)}
                              className="h-7 w-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-primary/20 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                              {playing?.id === m.id && isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                            </button>
                            <button onClick={() => confirmThen(t("music.confirm_remove_song"), () => removeSong(selectedPlData.id, id))}
                              className="h-7 w-7 flex items-center justify-center rounded-full text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100" title={t("music.remove_from_playlist")}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add songs to playlist modal ── */}
      {showAddSongs && selectedPlData && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-light border border-primary rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-primary shrink-0">
              <div>
                <h3 className="text-base font-semibold text-white">{t("music.add_songs_to", { name: selectedPlData.name })}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t("music.songs_available", { n: songsToAdd.length })}</p>
              </div>
              <button onClick={() => setShowAddSongs(false)} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            {/* Search */}
            <div className="px-5 py-3 border-b border-primary shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                <Input placeholder={t("music.search_songs")} value={addSongSearch} onChange={(e) => setAddSongSearch(e.target.value)} className="pl-9 h-8 text-xs" />
              </div>
            </div>
            {/* Song list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
              {songsToAdd.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                  <Music className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">{t("music.no_songs_available")}</p>
                </div>
              ) : (
                songsToAdd.map((m) => {
                  const selected = addSongBatch.has(m.id);
                  return (
                    <div key={m.id}
                      onClick={() => setAddSongBatch((prev) => {
                        const next = new Set(prev);
                        selected ? next.delete(m.id) : next.add(m.id);
                        return next;
                      })}
                      className={cn("flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                        selected ? "bg-primary/15 border border-primary/30" : "hover:bg-surface-lighter")}>
                      <div className={cn("w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                        selected ? "bg-primary border-primary text-white" : "border-primary")}>
                        {selected && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div className="w-9 h-9 rounded overflow-hidden bg-surface-lighter shrink-0">
                        <img src={musicCoverSrc(m.coverPath)} alt="" className="w-full h-full object-cover object-top scale-125"
                          onError={(e) => { (e.target as HTMLImageElement).src = getMusicCoverFallback(); }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{m.name}</p>
                        <p className="text-xs text-gray-500 truncate">{m.artist}{m.album ? ` · ${m.album}` : ""}</p>
                      </div>
                      <span className="text-[10px] text-gray-600 shrink-0">{m.duration}</span>
                    </div>
                  );
                })
              )}
            </div>
            {/* Footer bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-primary shrink-0">
              <button onClick={() => setAddSongBatch(new Set(songsToAdd.map((m) => m.id)))}
                className="text-xs text-gray-400 hover:text-white transition-colors">{t("music.select_all")}</button>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddSongs(false)}
                  className="px-4 py-1.5 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors">{t("settings.cancel")}</button>
                <button onClick={() => {
                  if (addSongBatch.size === 0) return;
                  addSongs(selectedPlData.id, Array.from(addSongBatch));
                  setShowAddSongs(false);
                  setAddSongBatch(new Set());
                }}
                  disabled={addSongBatch.size === 0}
                  className="px-4 py-1.5 text-xs rounded-lg bg-primary/20 text-primary-light hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium">
                  {t("music.add_selected", { n: addSongBatch.size })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Music grid ── */}
      {!showPlaylists && (
        <>
          {isLoading && music.length === 0 && <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-light" /></div>}
          {filtered.length > 0 ? (
            <>
              {layoutMode === "list" ? (
                <div className="flex flex-col gap-1">
                  {paginated.map((m, idx) => (
                    <div key={m.id} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-lighter transition-colors cursor-pointer group border relative",
                      playing?.id === m.id ? "bg-primary/10 border-primary/20" : "border-transparent")}
                      onClick={() => {
                        if (batch.showCheckboxes) { batch.toggle(m.id); return; }
                        handleGridPlay(m);
                      }}>
                      {batch.showCheckboxes && <BatchCheckbox inline checked={batch.selected.has(m.id)} onToggle={() => batch.toggle(m.id)} />}
                      {!batch.isBatchMode && <span className="w-6 text-center text-[11px] text-gray-600 shrink-0">{idx + 1}</span>}
                      <div className="w-9 h-9 rounded overflow-hidden bg-surface-lighter shrink-0">
                        <img src={musicCoverSrc(m.coverPath)} alt="" className="w-full h-full object-cover object-top scale-125"
                          onError={(e) => { (e.target as HTMLImageElement).src = getMusicCoverFallback(); }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm truncate", playing?.id === m.id ? "text-primary-light font-medium" : "text-gray-200")}>{m.name}</p>
                        <p className="text-xs text-gray-500 truncate">{m.artist}{m.album ? ` · ${m.album}` : ""}</p>
                        {m.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.tags.map((tag) => {
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
                      <span className="text-[10px] text-gray-600 shrink-0">{m.duration}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(m.id, "music"); }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-surface-lighter/50 transition-colors">
                          <Star className={cn("h-4 w-4", isFavorite(m.id) ? "fill-yellow-400 text-yellow-400" : "")} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setTagEditItem(m); }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-light hover:bg-surface-lighter/50 transition-colors">
                          <Tag className="h-4 w-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleGridPlay(m); }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
                          {playing?.id === m.id && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); confirmThen(t("music.confirm_delete"), () => deleteMusic(m.id)); }}
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
                  {paginated.map((m) => (
                    <div key={m.id} className="relative group"
                      onClick={() => { if (batch.showCheckboxes) batch.toggle(m.id); }}>
                      {batch.showCheckboxes && <BatchCheckbox checked={batch.selected.has(m.id)} onToggle={() => batch.toggle(m.id)} />}
                      <MusicCard music={m} onDelete={(id) => confirmThen(t("music.confirm_delete"), () => deleteMusic(id))} onPlay={batch.showCheckboxes ? () => {} : handleGridPlay} onEditTags={() => setTagEditItem(m)} compact={layoutMode === "small"} favorited={isFavorite(m.id)} onToggleFav={() => toggleFavorite(m.id, "music")} />
                    </div>
                  ))}
                </div>
              )}
              <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
            </>
          ) : !isLoading && (
            <EmptyState icon={<Music className="h-16 w-16" />} title={t("music.no_music")} hint={t("music.no_music_hint")} />
          )}
          {tagEditItem && <TagEditDialog open={true} onClose={() => setTagEditItem(null)} itemName={tagEditItem.name} tags={tagEditItem.tags} allTags={tagNames} onSave={(ts) => updateTags(tagEditItem.id, ts)} t={t} />}
          <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.msg || ""} onConfirm={() => { confirmDelete?.onOk(); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} />
        </>
      )}
    </div>
    </DropZone>
    {batch.showCheckboxes && <BatchBar selected={Array.from(batch.selected)} selectAll={batch.selectAll} clear={batch.leaveBatchMode} invert={batch.invert} onDelete={handleBatchDelete} allTags={tagNames} onBatchTag={handleBatchTag} t={t} onAddToPlaylist={() => setBatchPlaylistOpen(true)} />}

    {/* ── Full Player bar ── */}
    {playing && !isBackground && (
      <>
      {/* Lyrics placed above the player (separate fixed container) */}
      <div className="fixed bottom-48 left-1/2 -translate-x-1/2 z-[80] min-w-[520px] max-w-2xl pointer-events-none">
        <div className="pointer-events-auto px-6">
          <Lyrics filePath={playing.filePath} currentTime={currentTime} previewOffset={0.8} />
        </div>
      </div>

      <div
        className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-[80] rounded-xl shadow-2xl min-w-[520px] max-w-2xl ${playerBgCustom && playerBgColor ? "border border-white/10" : "bg-surface-light/95 border-white/5"}`}
        style={{ padding: "12px 20px", ...(playerBgCustom && playerBgColor ? { background: playerBgColor } : {}) }}>
        {/* 2 columns: cover (left), 3 rows (right) */}
        <div className="flex items-stretch gap-4">
          {/* LEFT: cover column — 有封面显示封面；无封面显示 CD 动/静态图 */}
          <div className="shrink-0 relative rounded overflow-hidden" style={{ width: 72 }}>
            {playing.coverPath ? (
              <img src={musicCoverSrc(playing.coverPath)} alt="" className="absolute inset-0 w-full h-full object-cover object-top scale-125"
                onError={(e) => { (e.target as HTMLImageElement).src = "/cd%20run.gif"; }} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <img src={isPlaying ? "/cd%20run.gif" : "/cd%20pause.png"} alt="" className="w-16 h-16 rounded-full object-cover shadow-lg" />
              </div>
            )}
          </div>

          {/* RIGHT: 3 rows */}
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            {/* Row 1: track info + close */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 flex items-center gap-2 truncate">
                <span className="text-[13px] font-semibold text-white truncate">{playing.name}</span>
                <span className="text-gray-600 shrink-0">·</span>
                <span className="text-[11px] text-gray-400 truncate">{playing.artist}</span>
                {playbackSourceLabel && (
                  <>
                    <span className="text-gray-600 shrink-0">·</span>
                    <span className="text-[10px] shrink-0 truncate" style={{ color: "color-mix(in srgb, var(--color-primary) 55%, var(--muted) 45%)" }}>{playbackSourceLabel}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {/* 播放器背景色板 + 透明度 */}
                <ColorPickerBtn color={playerBgColor} onChange={setPlayerBgColor} disabled={!playerBgCustom} />
                <button onClick={() => setBackground(true)}
                  className="text-gray-500 hover:text-primary-light transition-colors p-1"
                  title={t("music.mini_to_toolbar")}>
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={stop}
                  className="text-gray-500 hover:text-red-400 transition-colors p-1"
                  title={t("music.close")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Row 2: progress bar 完全横向铺满，无左右偏移留白 */}
            <div className="flex items-center gap-2 w-full">
              <span className="text-[11px] text-gray-500 text-right tabular-nums shrink-0">{fmtTime(currentTime)}</span>
              <div ref={progressRef} className="flex-1 h-5 flex items-center cursor-pointer group"
                onMouseDown={handleProgressMouseDown}>
                <div className="w-full h-1.5 rounded-full bg-surface-lighter relative overflow-visible group-hover:h-2 transition-all">
                  <div className="absolute left-0 top-0 h-full rounded-full bg-primary-light transition-[width] duration-100"
                    style={{ width: `${progressPct}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progressPct}% - 4px)` }} />
                </div>
              </div>
              <span className="text-[11px] text-gray-500 tabular-nums shrink-0">{fmtTime(duration)}</span>
            </div>

            {/* Row 3: controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setVolume(volume === 0 ? 1 : 0)}
                  className="text-gray-500 hover:text-white p-1">
                  {volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <input type="range" min="0" max="1" step="0.05" value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 accent-primary-light cursor-pointer" style={{ appearance: "auto" }} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-primary-light" title={t("music.add_to_playlist")} onClick={() => setPlaylistOpen(!playlistOpen)}><ListPlus className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon"
                  className={`h-7 w-7 transition-colors relative ${lyricFontSize === "off" ? "text-gray-600" : lyricFontSize === "large" ? "text-primary-light" : "text-gray-500 hover:text-primary-light"}`}
                  title={lyricFontSize === "off" ? t("music.lyric_off_title") : lyricFontSize === "large" ? t("music.lyric_large_title") : t("music.lyric_normal_title")}
                  onClick={() => setLyricFontSize(lyricFontSize === "normal" ? "large" : lyricFontSize === "large" ? "off" : "normal")}>
                  <Type className={`h-3.5 w-3.5 ${lyricFontSize === "large" ? "stroke-[3]" : ""}`} />
                  {lyricFontSize === "off" && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="block w-[1.5px] h-4 bg-current rotate-45" />
                    </span>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <PlayModeControls />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" onClick={handlePrev}><SkipBack className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-white bg-primary/20 hover:bg-primary/30 rounded-full" onClick={toggle}>
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" onClick={handleNext}><SkipForward className="h-4 w-4" /></Button>
              </div>
              <div className="shrink-0 flex flex-col items-center" style={{ width: 132, marginLeft: -5 }}>
                <VizBar mode={visualizerMode} />
                <div className="flex gap-0.5 mt-0.5">
                  {(["bars", "dots", "blocks"] as const).map((m) => (
                    <button key={m} onClick={() => setVisualizerMode(m)}
                      className={`p-0.5 rounded transition-colors ${visualizerMode === m ? "text-primary-light bg-primary/15" : "text-gray-600 hover:text-gray-300"}`}
                      title={m === "bars" ? t("music.viz_bars") : m === "dots" ? t("music.viz_dots") : t("music.viz_blocks")}>
                      <VizToggleIcon mode={m} />
                    </button>
                  ))}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )}

    {/* Playlist popover */}
    {playlistOpen && playing && (
      <div className="fixed bottom-[148px] left-1/2 -translate-x-1/2 z-[85] bg-surface-light/98 backdrop-blur-md border border-primary rounded-xl px-4 py-3 shadow-2xl min-w-[260px]">
        <p className="text-xs text-gray-400 mb-2">{t("music.add_to_playlist")}</p>
        {playlists.map((pl) => (
          <button key={pl.id} onClick={() => { addSong(pl.id, playing.id); setPlaylistOpen(false); }}
            className="w-full text-left text-xs text-gray-300 hover:text-white hover:bg-surface-lighter rounded px-2 py-1.5 transition-colors">
            {pl.name} ({pl.musicIds.length})
          </button>
        ))}
        <div className="border-t border-primary mt-2 pt-2 flex gap-1">
          <Input placeholder={t("music.new_playlist")} className="h-7 text-xs" onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) { const pl = create((e.target as HTMLInputElement).value.trim()); addSong(pl.id, playing.id); setPlaylistOpen(false); } }} />
        </div>
      </div>
    )}

    {/* Batch add to playlist popover */}
    {batchPlaylistOpen && (
      <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[90] bg-surface-light/98 backdrop-blur-md border border-primary rounded-xl px-4 py-3 shadow-2xl min-w-[260px]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400">{t("music.batch_add_to_playlist")} ({t("music.songs_count", { n: batch.selected.size })})</p>
          <button onClick={() => setBatchPlaylistOpen(false)} className="text-gray-500 hover:text-white"><X className="h-3 w-3" /></button>
        </div>
        {playlists.map((pl) => (
          <button key={pl.id} onClick={() => { addSongs(pl.id, Array.from(batch.selected)); setBatchPlaylistOpen(false); batch.clear(); }}
            className="w-full text-left text-xs text-gray-300 hover:text-white hover:bg-surface-lighter rounded px-2 py-1.5 transition-colors">
            {pl.name} ({pl.musicIds.length})
          </button>
        ))}
        <div className="border-t border-primary mt-2 pt-2 flex gap-1">
          <Input placeholder={t("music.new_playlist")} className="h-7 text-xs" onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) { const pl = create((e.target as HTMLInputElement).value.trim()); addSongs(pl.id, Array.from(batch.selected)); setBatchPlaylistOpen(false); batch.clear(); } }} />
        </div>
      </div>
    )}
    </>
  );
}

// ── Visualizer: bars ──
const VizBar = React.memo(function VizBar({ mode }: { mode: string }) {
  const bars = useAudioPlayerStore((s) => s.visualizerBars);
  if (mode === "dots") return <DotsViz bars={bars} />;
  if (mode === "blocks") return <BlocksViz bars={bars} />;

  // Default "bars"
  return (
    <div style={{ height: 30, display: "flex", alignItems: "end", gap: 1, marginTop: -2, transform: "translateY(-1px)", width: 132, overflow: "hidden" }}>
      {bars.map(function (v: number, i: number) {
        return (
          <span key={i} style={{
            width: 3, flexShrink: 0, height: Math.max(2, v * 35),
            background: "var(--color-primary-light)", opacity: 0.4 + v * 0.6,
          }} />
        );
      })}
    </div>
  );
});

// ── Visualizer: particle dots ──
const DotsViz = React.memo(function DotsViz({ bars }: { bars: number[] }) {
  const H = 30; const dotBase = 2.5;
  return (
    <div style={{ width: 132, height: H, display: "flex", alignItems: "end", justifyContent: "space-between", paddingInline: 2, marginTop: -2, overflow: "hidden" }}>
      {bars.map((v, i) => {
        const size = dotBase + v * 4;
        const opacity = 0.4 + v * 0.6;
        const glow = `0 0 ${4 + v * 6}px var(--color-primary-light)`;
        return (
          <div key={i} style={{
            width: size, height: size, borderRadius: "50%", background: "var(--color-primary-light)",
            opacity, boxShadow: glow,
            transform: `translateY(-${v * (H - 6)}px)`,
            flexShrink: 0,
          }} />
        );
      })}
    </div>
  );
});

// ── Visualizer: blocks (每柱5段，去CSS transition防卡) ──
const BlocksViz = React.memo(function BlocksViz({ bars }: { bars: number[] }) {
  const N = bars.length; const SEGS = 5; const MAX_H = 35;
  return (
    <div style={{ height: 30, display: "flex", alignItems: "end", gap: 1, marginTop: -2, transform: "translateY(-1px)", width: 132, overflow: "hidden" }}>
      {bars.map(function (v: number, i: number) {
        const h = Math.max(1, Math.round(v * MAX_H));
        const segH = Math.max(1, Math.floor(h / SEGS));
        // 静态段数组，每帧只变height/opacity，无transition
        const segs = [];
        for (let s = 0; s < SEGS; s++) {
          const alpha = 0.3 + v * 0.7;
          segs.push(<span key={s} style={{ display: "block", width: 3, height: segH, background: "var(--color-primary-light)", opacity: alpha, flexShrink: 0 }} />);
        }
        return <span key={i} style={{ width: 3, flexShrink: 0, height: h, display: "flex", flexDirection: "column-reverse", gap: 1 }}>{segs}</span>;
      })}
    </div>
  );
});

// ── Viz toggle icon ──
function VizToggleIcon({ mode }: { mode: string }) {
  return (
    <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      {mode === "bars" && (<><rect x="1" y="10" width="2" height="5" rx="0.5"/><rect x="5" y="5" width="2" height="10" rx="0.5"/><rect x="9" y="3" width="2" height="12" rx="0.5"/><rect x="13" y="7" width="2" height="8" rx="0.5"/></>)}
      {mode === "dots" && (<><circle cx="2" cy="13" r="1.5"/><circle cx="6" cy="9" r="1.5"/><circle cx="10" cy="5" r="1.5"/><circle cx="14" cy="11" r="1.5"/></>)}
      {mode === "blocks" && (<><rect x="1" y="8" width="2" height="2" rx="0.5"/><rect x="1" y="11" width="2" height="2" rx="0.5"/><rect x="5" y="4" width="2" height="2" rx="0.5"/><rect x="5" y="7" width="2" height="2" rx="0.5"/><rect x="5" y="10" width="2" height="2" rx="0.5"/><rect x="9" y="2" width="2" height="2" rx="0.5"/><rect x="9" y="5" width="2" height="2" rx="0.5"/><rect x="9" y="8" width="2" height="2" rx="0.5"/></>)}
    </svg>
  );
}

// ── Player background color picker with opacity ──
function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function rgbaStr(h: string, a: number) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function parseAlpha(c: string): number { const m = c.match(/rgba\([\d, ]+,([\d.]+)\)/); return m ? parseFloat(m[1]) : 1; }
function parseHex(c: string): string {
  if (!c) return "#1a1f2e";
  // direct hex match
  const m = c.match(/#[0-9a-fA-F]{6}/);
  if (m) return m[0];
  // rgba → hex
  const rm = c.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
  if (rm) return "#" + [rm[1], rm[2], rm[3]].map((v) => parseInt(v).toString(16).padStart(2, "0")).join("");
  return "#1a1f2e";
}

function ColorPickerBtn({ color, onChange, disabled }: { color: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const hex = parseHex(color);
  const alpha = parseAlpha(color);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const apply = (h: string, a: number) => onChange(a >= 1 ? h : rgbaStr(h, a));

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => { if (!disabled) setOpen((v) => !v); }}
        className={`p-1 transition-colors ${disabled ? "text-gray-700 cursor-not-allowed" : "text-gray-500 hover:text-primary-light"}`}
        title={disabled ? "请在设置 → 音乐 → 播放器背景中开启自定义" : "播放器背景颜色"}>
        <Palette className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 bg-surface-light border border-primary/30 rounded-xl p-4 shadow-2xl z-[90] flex flex-col gap-3 min-w-[180px]">
          <div className="flex items-center gap-2">
            <input ref={inputRef} type="color" value={hex}
              onChange={(e) => apply(e.target.value, alpha)}
              className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent" />
            <span className="text-xs text-gray-300">{hex}</span>
            {color && (
              <button onClick={() => { onChange(""); setOpen(false); }}
                className="text-[10px] text-gray-500 hover:text-red-400 ml-auto">清除</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 shrink-0">透明度</span>
            <input type="range" min="10" max="100" value={Math.round(alpha * 100)}
              onChange={(e) => apply(hex, Number(e.target.value) / 100)}
              className="flex-1 h-1 accent-primary-light" />
            <span className="text-[10px] text-gray-400 w-7 text-right">{Math.round(alpha * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
