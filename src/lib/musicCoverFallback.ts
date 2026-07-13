import { useThemeStore } from "@/stores/themeStore";

const BASES: Record<string, string> = {
  "ice-girl": "/themes/ice%20girl",
  "cyber-girl": "/themes/cyber%20girl",
};

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
  const base = BASES[theme];
  if (base) return `${base}/icons/music.webp`;
  return DEFAULT_SVG;
}
