import { create } from "zustand";
import type { Music as MusicType } from "@/types/music";
import { useMusicStore } from "@/stores/musicStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { useSettingsStore } from "@/stores/settingsStore";

// Singleton audio element — not in React tree, survives navigation
let _audio: HTMLAudioElement | null = null;

export function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = "auto";
  }
  return _audio;
}

// ── Public helpers ──

let _audioSrc = "";

export async function loadAudioSrc(filePath: string): Promise<string> {
  if (_audioSrc) URL.revokeObjectURL(_audioSrc);
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const data = await readFile(filePath);
  const ext = (filePath.split(".").pop() || "mp3").toLowerCase();
  const mimeMap: Record<string, string> = { mp3: "audio/mpeg", flac: "audio/flac", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg", wma: "audio/x-ms-wma", aac: "audio/aac" };
  const blob = new Blob([data], { type: mimeMap[ext] || "audio/mpeg" });
  _audioSrc = URL.createObjectURL(blob);
  return _audioSrc;
}

export function disposeAudioSrc() {
  if (_audioSrc) { URL.revokeObjectURL(_audioSrc); _audioSrc = ""; }
}

export function fmtTime(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Callbacks ──

let _onEnded: (() => void) | null = null;
let _onPrev: (() => void) | null = null;
let _onNext: (() => void) | null = null;
let _transitioning = false;

// Playback source: set by the music page so auto-advance / prev / next work
// even after navigating away. Falls back to all music when empty.
let _playbackSource: string[] = [];
let _playbackSourceId = "";   // playlist id ("" = all music)
let _playbackSourceLabel = "音乐库";

function resolveSource(): string[] {
  if (_playbackSource.length > 0) return _playbackSource;
  return useMusicStore.getState().music.map((m) => m.id);
}

function defaultAutoNext() {
  const { music } = useMusicStore.getState();
  const { getNextSong } = usePlaylistStore.getState();
  const track = useAudioPlayerStore.getState().track;
  if (!track || music.length === 0) return;

  const source = resolveSource();
  const idx = source.indexOf(track.id);
  if (idx === -1) return;

  const { id } = getNextSong(idx, source);
  if (!id) return;

  const nextTrack = music.find((m) => m.id === id);
  if (nextTrack) useAudioPlayerStore.getState().play(nextTrack);
}

function defaultPrev() {
  const { music } = useMusicStore.getState();
  const track = useAudioPlayerStore.getState().track;
  if (!track || music.length === 0) return;

  const source = resolveSource();
  const idx = source.indexOf(track.id);
  if (idx === -1) return;

  const prevIdx = idx > 0 ? idx - 1 : source.length - 1;
  const prevTrack = music.find((m) => m.id === source[prevIdx]);
  if (prevTrack) useAudioPlayerStore.getState().play(prevTrack);
}

function defaultNext() {
  const { music } = useMusicStore.getState();
  const track = useAudioPlayerStore.getState().track;
  if (!track || music.length === 0) return;

  const source = resolveSource();
  const idx = source.indexOf(track.id);
  if (idx === -1) return;

  const nextIdx = idx >= source.length - 1 ? 0 : idx + 1;
  const nextTrack = music.find((m) => m.id === source[nextIdx]);
  if (nextTrack) useAudioPlayerStore.getState().play(nextTrack);
}

interface AudioPlayerState {
  track: MusicType | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBackground: boolean;
  volume: number;
  visualizerBars: number[];

  play: (track: MusicType) => Promise<void>;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (pct: number) => void;
  setVolume: (v: number) => void;
  setBackground: (v: boolean) => void;
  setOnEnded: (fn: (() => void) | null) => void;
  setOnPrevNext: (prev: (() => void) | null, next: (() => void) | null) => void;
  playbackSourceId: string;
  playbackSourceLabel: string;
  setPlaybackSource: (ids: string[], id: string, label: string) => void;
  prev: () => void;
  next: () => void;
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => {
  const audio = getAudio();
  audio.volume = useSettingsStore.getState().lastVolume;

  audio.addEventListener("timeupdate", () => {
    const s = get();
    if (!s.isPlaying) return;
    // Guard against NaN/Infinity on broken audio devices
    const d = audio.duration;
    const t = audio.currentTime;
    if (!isFinite(d) || !isFinite(t)) return;
    set({ currentTime: t, duration: d || 0 });
  });
  audio.addEventListener("play", () => set({ isPlaying: true }));
  audio.addEventListener("pause", () => {
    if (!_transitioning) set({ isPlaying: false });
  });
  audio.addEventListener("ended", () => {
    if (_onEnded) { _onEnded(); } else { set({ isPlaying: false }); }
  });
  audio.addEventListener("error", () => {
    // Audio device missing / codec failure — don't leave isPlaying=true
    _transitioning = false;
    set({ isPlaying: false, track: null, visualizerBars: new Array(32).fill(0.01) });
  });

  return {
    track: null,
    isPlaying: false,
    volume: useSettingsStore.getState().lastVolume,
    visualizerBars: new Array(32).fill(0.01),
    currentTime: 0,
    duration: 0,
    isBackground: false,

    playbackSourceId: _playbackSourceId,
    playbackSourceLabel: _playbackSourceLabel,

    setOnEnded: (fn) => { _onEnded = fn; },
    setOnPrevNext: (prev, next) => { _onPrev = prev; _onNext = next; },
    setPlaybackSource: (ids, id, label) => {
      _playbackSource = ids;
      _playbackSourceId = id;
      _playbackSourceLabel = label;
      set({ playbackSourceId: id, playbackSourceLabel: label });
    },
    prev: () => { if (_onPrev) _onPrev(); },
    next: () => { if (_onNext) _onNext(); },

    play: async (track: MusicType) => {
      _transitioning = true;
      set({ track, isPlaying: true, currentTime: 0, duration: 0 });

      if (!_onEnded) _onEnded = defaultAutoNext;
      if (!_onPrev) _onPrev = defaultPrev;
      if (!_onNext) _onNext = defaultNext;

      try {
        const src = await loadAudioSrc(track.filePath);
        audio.src = src;
        audio.load();
        try { await audio.play(); } catch {}
      } catch {}
      _transitioning = false;
    },

    toggle: () => {
      const { isPlaying } = get();
      if (isPlaying) audio.pause(); else audio.play();
    },

    pause: () => { audio.pause(); set({ visualizerBars: new Array(32).fill(0.01) }); },

    stop: () => {
      _onEnded = null; _onPrev = null; _onNext = null;
      _playbackSource = [];
      _playbackSourceId = "";
      _playbackSourceLabel = "音乐库";
      _transitioning = false;
      audio.pause();
      audio.src = "";
      disposeAudioSrc();
      set({ track: null, isPlaying: false, currentTime: 0, duration: 0, isBackground: false, visualizerBars: new Array(32).fill(0.01), playbackSourceId: "", playbackSourceLabel: "音乐库" });
    },

    seek: (pct: number) => {
      const d = audio.duration || get().duration;
      if (d) { audio.currentTime = pct * d; set({ currentTime: pct * d }); }
    },

    setBackground: (v: boolean) => set({ isBackground: v }),

    setVolume(v: number) {
      const vol = Math.max(0, Math.min(1, v));
      audio.volume = vol;
      set({ volume: vol });
      useSettingsStore.getState().setLastVolume(vol);
    },
  };
});
