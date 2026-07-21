/**
 * Steam CDN image variants in priority order for game card display.
 * library_600x900.jpg is the best (portrait poster), but not all apps have it.
 */
const CDN_VARIANTS = [
  "library_600x900.jpg", // 600×900 portrait poster — best for cards
  "library_hero.jpg",    // 3840×1240 hero banner — high-res fallback
  "capsule_616x353.jpg", // 616×353 medium capsule
  "header.jpg",          // 460×215 — last CDN resort
] as const;

/**
 * Given a Steam CDN cover URL (or any URL), return a list of CDN variants
 * to try in priority order. The original URL's variant is moved to the front.
 * For non-Steam URLs, returns just the original URL.
 */
export function steamCdnFallbacks(coverPath: string): string[] {
  const m = coverPath.match(/\/steam\/apps\/(\d+)\/[^/]+$/);
  if (!m) return [coverPath];
  const appId = m[1];
  const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}`;
  const urls = CDN_VARIANTS.map((v) => `${base}/${v}`);
  // If the stored URL matches one of our variants, keep it first; if not, prepend it
  if (!urls.includes(coverPath)) {
    urls.unshift(coverPath);
  } else {
    // Move the stored variant to the front
    const idx = urls.indexOf(coverPath);
    if (idx > 0) {
      urls.splice(idx, 1);
      urls.unshift(coverPath);
    }
  }
  return urls;
}

/** Landscape (wide banner) CDN variants in priority order */
const LANDSCAPE_VARIANTS = [
  "library_hero.jpg",    // 3840×1240 hero banner — best for horizontal cards
  "capsule_616x353.jpg", // 616×353 medium capsule
  "header.jpg",          // 460×215 — last resort, still landscape-ish
] as const;

/**
 * Build a CDN fallback URL list for landscape images given a Steam app ID.
 * Used when the local landscape cover is unavailable.
 */
export function steamLandscapeFallbacks(appId: string): string[] {
  const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}`;
  return LANDSCAPE_VARIANTS.map((v) => `${base}/${v}`);
}

/** Extract Steam app ID from a game ID like "steam_123456" */
export function extractSteamAppId(gameId: string): string | null {
  const m = gameId.match(/^steam_(\d+)$/);
  return m ? m[1] : null;
}
