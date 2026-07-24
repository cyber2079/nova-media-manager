/**
 * Central URL builder for theme assets.
 *
 * VITE_LICENSE_TIER (dev): known themes have assets on disk in public/.
 *   Unknown themes (installed .nvtp) use nova:// protocol — works in dev too.
 * Production: always uses nova:// protocol (Rust decrypts assets in memory).
 */
const KNOWN_THEMES: Record<string, string> = {
  "ice-girl": "/themes/ice%20girl",
  "cyber-girl": "/themes/cyber%20girl",
  cyberpunk: "/themes/cyberpunk",
  "cyber-grid": "/themes/cyber-grid",
  default: "",
};

export function themeUrl(themeId: string, assetPath: string): string {
  if ((import.meta as any).env?.VITE_LICENSE_TIER) {
    // Dev: known themes have assets on disk
    if (KNOWN_THEMES[themeId] !== undefined) {
      if (themeId === "default") return "";
      return `${KNOWN_THEMES[themeId]}/${assetPath}`;
    }
  }
  // Installed .nvtp themes → nova:// protocol (works in both dev & production)
  return `nova://localhost/${themeId}/${assetPath}`;
}

// ── Legacy ThemeAssets (used by existing ice-girl/cyber-girl components) ──
export const ThemeAssets = {
  ice: {
    base: (path: string) => themeUrl("ice-girl", path),
    bg: themeUrl("ice-girl", "bg.webp"),
    bgVideo: themeUrl("ice-girl", "video/bg-loop.mp4"),
    head: themeUrl("ice-girl", "head.webp"),
    musicCover: themeUrl("ice-girl", "music-cover.webp"),
    icon: (name: string) => themeUrl("ice-girl", `icons/${name}`),
    face: (name: string) => themeUrl("ice-girl", `faces/${name}.webp`),
    video: (name: string) => themeUrl("ice-girl", `video/${name}.mp4`),
  },
  cg: {
    base: (path: string) => themeUrl("cyber-girl", path),
    bg: themeUrl("cyber-girl", "bg.webp"),
    musicCover: themeUrl("cyber-girl", "music-cover.webp"),
    icon: (name: string) => themeUrl("cyber-girl", `icons/${name}`),
    face: (name: string) => themeUrl("cyber-girl", `faces/${name}.webp`),
    scene: (name: string) => themeUrl("cyber-girl", `scenes/${name}`),
  },
};