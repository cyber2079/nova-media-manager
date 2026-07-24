// NeonIcon — IconsNeon inline SVG renderer
// Wraps a Lucide icon, replaces with IconsNeon SVG on non-default themes
// Supports random neon color per element (Todos mode)
import { useId, useMemo } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import iconData from "./neon-icon-data.json";
import type { ReactNode } from "react";

// All 7 IconsNeon colors (same as styles.css)
const NEON_COLORS = ["neon-cyan", "neon-magenta", "neon-green", "neon-orange", "neon-purple", "neon-yellow", "neon-red"] as const;

// Simple FNV-1a hash seeded with the random seed
function hashIcon(seed: number, name: string, id: string): number {
  let h = seed ^ 0x811c9dc5;
  const str = name + ":" + id;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

interface Props {
  name: string;
  size?: number;
  className?: string;
  children?: ReactNode;
}

export default function NeonIcon({ name, size = 16, className = "", children }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const paletteRandom = useSettingsStore((s) => s.paletteRandomEnabled);
  const paletteSeed = useSettingsStore((s) => s.paletteRandomSeed);
  const elementId = useId();

  const finalColorClass = useMemo(() => {
    if (theme === "default") return null;
    const entry = (iconData as unknown as Record<string, [string, string]>)[name];
    if (!entry) return paletteRandom ? null : theme === "default" ? null : null;
    if (!paletteRandom || paletteSeed === 0) return entry[0]; // locked to mapped color
    // Random from 7 neon colors: hash(seed, name, elementId) mod 7
    const idx = hashIcon(paletteSeed, name, elementId) % NEON_COLORS.length;
    return NEON_COLORS[idx];
  }, [theme, name, paletteRandom, paletteSeed, elementId]);

  if (theme === "default") return children ?? null;

  const entry = (iconData as unknown as Record<string, [string, string]>)[name];
  if (!entry) return children ?? null;

  const colorClass = finalColorClass || entry[0];
  const svgInner = entry[1];
  const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgInner}</svg>`;

  return (
    <span
      className={`neon-icon ${colorClass} ${className}`}
      style={{ width: size, height: size, fontSize: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
