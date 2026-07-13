/**
 * Central URL builder for theme assets.
 *
 * Dev mode: returns direct filesystem paths via Vite's public/ dir.
 * Production: returns nova:// protocol URLs (Rust decrypts assets in memory).
 *
 * Usage: themeUrl("ice-girl", "faces/angry.webp")
 */
const THEME_PATH_MAP: Record<string, string> = {
  "ice-girl": "/themes/ice%20girl",
  "cyber-girl": "/themes/cyber%20girl",
};

export function themeUrl(themeId: string, assetPath: string): string {
  if (import.meta.env.VITE_LICENSE_TIER === "pro") {
    const base = THEME_PATH_MAP[themeId] || `/themes/${themeId}`;
    return `${base}/${assetPath}`;
  }
  return `https://nova.localhost/${themeId}/${assetPath}`;
}

/**
 * Pre-built URLs for common theme assets.
 * Use these to avoid string concatenation spread across multiple files.
 */
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
