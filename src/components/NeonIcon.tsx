// NeonIcon — IconsNeon inline SVG renderer
import { useId, useMemo } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import iconData from "./neon-icon-data.json";
import type { ReactNode } from "react";

const NEON_COLORS = ["neon-cyan", "neon-magenta", "neon-green", "neon-orange", "neon-purple", "neon-yellow", "neon-red"] as const;

// Convert hex like #00f5ff to the corresponding neon-* CSS class
function hexToNeonClass(hex: string): string | null {
  const map: Record<string, string> = {
    "#00f5ff": "neon-cyan", "#ff00ff": "neon-magenta", "#39ff14": "neon-green",
    "#ff6600": "neon-orange", "#bf00ff": "neon-purple", "#ffff00": "neon-yellow", "#ff0040": "neon-red",
  };
  return map[hex.toLowerCase()] || null;
}

function hashIcon(seed: number, name: string, id: string): number {
  let h = seed ^ 0x811c9dc5;
  const str = name + ":" + id;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

interface Props { name: string; size?: number; className?: string; children?: ReactNode; }

export default function NeonIcon({ name, size = 16, className = "", children }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const paletteAccent = useSettingsStore((s) => s.paletteAccent);
  const paletteCustomized = useSettingsStore((s) => s.paletteCustomized);
  const paletteRandom = useSettingsStore((s) => s.paletteRandomEnabled);
  const paletteSeed = useSettingsStore((s) => s.paletteRandomSeed);
  const elementId = useId();

  const finalColorClass = useMemo(() => {
    if (theme === "default") return null;

    const entry = (iconData as unknown as Record<string, [string, string]>)[name];
    const mappedColor = entry?.[0] || "neon-cyan";

    // Priority 1: random Todos mode
    if (paletteRandom && paletteSeed !== 0) {
      return NEON_COLORS[hashIcon(paletteSeed, name, elementId) % NEON_COLORS.length];
    }

    // Priority 2: palette customized to a specific hex → map to nearest neon class
    if (paletteCustomized && paletteAccent) {
      const mapped = hexToNeonClass(paletteAccent);
      if (mapped) return mapped;
    }

    // Priority 3: theme default color (from theme.json)
    return mappedColor;
  }, [theme, name, paletteAccent, paletteCustomized, paletteRandom, paletteSeed, elementId]);

  if (theme === "default") return children ?? null;

  const entry = (iconData as unknown as Record<string, [string, string]>)[name];
  if (!entry) return children ?? null;

  const colorClass = finalColorClass || entry[0];
  const svgInner = entry[1];
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + svgInner + '</svg>';

  return (
    <span className={`neon-icon ${colorClass} ${className}`}
      style={{ width: size, height: size, fontSize: size }}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
