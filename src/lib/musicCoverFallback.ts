import { useThemeStore } from "@/stores/themeStore";
import { themeUrl } from "@/lib/themeBase";
import { convertFileSrc } from "@tauri-apps/api/core";

// Inline SVG headphones icon — dim and unobtrusive, for onError edge cases only
const DEFAULT_SVG = [
  "data:image/svg+xml,",
  "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1.5' opacity='0.4'%3E",
  "%3Cpath d='M3 18v-6a9 9 0 0 1 18 0v6'/%3E",
  "%3Cpath d='M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z'/%3E",
  "%3C/svg%3E",
].join("");

/**
 * Returns the fallback music cover image URL based on the currently active theme.
 * - Premium themes (ice-girl, cyber-girl): uses `{theme}/music-cover.webp`
 * - Default theme: uses an inline SVG music-note icon
 */
export function getMusicCoverFallback(): string {
  const theme = useThemeStore.getState().theme;
  if (theme === "ice-girl" || theme === "cyber-girl") return themeUrl(theme, "music-cover.webp");
  return DEFAULT_SVG;
}

/**
 * 封面路径 → 可加载的 URL。
 * DB 里存的是本地绝对路径，直接塞 <img src> 会被当相对 URL 请求出 404 —
 * 必须经 asset 协议转换；已是 URL（http/data/blob/公共资源）的原样返回。
 */
export function musicCoverSrc(coverPath?: string): string {
  if (coverPath) {
    if (/^(https?:|data:|blob:|asset:|\/)/.test(coverPath)) return coverPath;
    try { return convertFileSrc(coverPath); } catch { /* not in Tauri */ }
  }
  return getMusicCoverFallback();
}
