// ── Color conversion utilities ──
// Extracted from settingsStore.ts to a shared lib module
// so CSS, components, and stores can all use the same conversion logic.

export function hexToHSL(hex: string): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const h = hex.replace("#", "");
  if (h.length === 3) { r = parseInt(h[0]+h[0],16); g = parseInt(h[1]+h[1],16); b = parseInt(h[2]+h[2],16); }
  else if (h.length >= 6) { r = parseInt(h.slice(0,2),16); g = parseInt(h.slice(2,4),16); b = parseInt(h.slice(4,6),16); }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0; const lit = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  return [Math.round(hue * 360), Math.round(sat * 100), Math.round(lit * 100)];
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return "#" + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

export function computeThemeColors(base: string) {
  const [h, s, l] = hexToHSL(base);
  return {
    primary: hslToHex(h, Math.min(80, s), Math.max(35, Math.min(55, l))),
    light: hslToHex(h, Math.max(25, s - 10), Math.min(88, l + 22)),
    dark: hslToHex(h, Math.min(85, s + 8), Math.max(14, l - 14)),
    surface: hslToHex(h, Math.max(4, s/4), Math.max(6, Math.min(10, l/3))),
    surfaceLight: hslToHex(h, Math.max(5, s/4), Math.max(10, Math.min(15, l/2.5))),
    surfaceLighter: hslToHex(h, Math.max(6, s/3), Math.max(14, Math.min(22, l/2))),
    border: hslToHex(h, Math.max(15, s/3), Math.min(55, l + 8)),
    accent: hslToHex(h, Math.min(75, s + 5), Math.min(60, l + 5))};
}

export const COLOR_PRESETS = [
  "#f59e0b", "#00e5a0", "#4488ff", "#8b5cf6",
  "#e06040", "#87ceeb", "#ff88cc", "#f99e1a",
];
