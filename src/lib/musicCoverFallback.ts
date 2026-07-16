import { useThemeStore } from "@/stores/themeStore";
import { themeUrl } from "@/lib/themeBase";
import { convertFileSrc } from "@tauri-apps/api/core";

// Inline SVG music-note icon (lucide-react Music equivalent) for default theme
const DEFAULT_SVG = [
  "data:image/svg+xml,",
  "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234788f0' stroke-width='1.5'%3E",
  "%3Cpath d='M9 18V5l12-2v13'/%3E",
  "%3Ccircle cx='6' cy='18' r='3'/%3E",
  "%3Ccircle cx='18' cy='16' r='3'/%3E",
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
