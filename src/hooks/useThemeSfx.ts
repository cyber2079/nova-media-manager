// Theme SFX Engine — plays UI sound effects from .nvtp theme packs
//
// Uses nova:// protocol to load audio from the theme ZIP.
// Listens for global UI interaction events and plays matching sounds.

import { useEffect, useRef } from "react";
import { themeUrl } from "@/lib/themeBase";

type SfxKey =
  | "hover" | "click" | "menuOpen" | "menuClose"
  | "dialogOpen" | "dialogClose" | "notification"
  | "pageTransition" | "startup" | "countdownAlert"
  | "countdownTick";

const SFX_KEYS: SfxKey[] = [
  "hover", "click", "menuOpen", "menuClose",
  "dialogOpen", "dialogClose", "notification",
  "pageTransition", "startup", "countdownAlert", "countdownTick",
];

// Preload a sound by full URL (relative paths from theme.json resolved via themeUrl)
let audioPool: Record<string, HTMLAudioElement> = {};

function ensureAudio(url: string): HTMLAudioElement {
  if (audioPool[url]) return audioPool[url];
  const a = new Audio();
  a.volume = 0.3;
  a.preload = "auto";
  a.src = url;
  audioPool[url] = a;
  return a;
}

async function playSfx(path: string) {
  if (!path) return;
  try {
    const a = ensureAudio(path);
    a.currentTime = 0;
    await a.play();
  } catch {
    // Audio not available (dev mode, no files, etc.)
  }
}

const DEBOUNCE_MS: Partial<Record<SfxKey, number>> = {
  hover: 100,
  click: 0,
  menuOpen: 200,
  menuClose: 200,
  pageTransition: 500,
};

const lastPlayed: Partial<Record<SfxKey, number>> = {};

function shouldPlay(key: SfxKey): boolean {
  const debounce = DEBOUNCE_MS[key] ?? 0;
  const now = Date.now();
  const last = lastPlayed[key] ?? 0;
  if (now - last < debounce) return false;
  lastPlayed[key] = now;
  return true;
}

/** Call once in Layout. Theme-aware — rebuilds audio pool on theme change. */
export function useThemeSfx(themeId: string) {
  const pathsRef = useRef<Record<SfxKey, string>>({} as any);
  const enabledRef = useRef(false);

  useEffect(() => {
    // Read SFX enabled state from CSS var (injected by useThemeTokens)
    const enabled = getComputedStyle(document.documentElement)
      .getPropertyValue("--nv-sfx-enabled").trim();
    enabledRef.current = enabled !== "0" && enabled !== "false";

    // Rebuild paths with full URLs
    const paths: Record<string, string> = {};
    const computed = getComputedStyle(document.documentElement);
    for (const key of SFX_KEYS) {
      const varName = `--nv-sfx-${key}`;
      let val = computed.getPropertyValue(varName).trim()
        .replace(/^"(.*)"$/, "$1");
      if (val && val !== "" && val !== "none") {
        // Resolve relative audio path to full URL via themeUrl
        paths[key] = themeUrl(themeId, val);
      }
    }
    pathsRef.current = paths as any;

    // Preload
    for (const p of Object.values(paths)) {
      ensureAudio(p as string);
    }

    // Startup sound
    if (enabledRef.current && paths.startup) {
      playSfx(paths.startup);
    }
  }, [themeId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, [role=button]")) {
        if (shouldPlay("click")) playSfx(pathsRef.current.click);
      }
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [themeId]);

  /** Public API for imperative playback */
  return {
    play: (key: SfxKey) => {
      if (!enabledRef.current) return;
      const path = pathsRef.current[key];
      if (path && shouldPlay(key)) playSfx(path);
    },
  };
}
