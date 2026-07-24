// NeonIcon — wraps a Lucide icon, replaces it with IconsNeon SVG on non-default themes
import { useThemeStore } from "@/stores/themeStore";
import iconData from "./neon-icon-data.json";
import type { ReactNode } from "react";

interface Props {
  name: string;
  size?: number;
  className?: string;
  children?: ReactNode; // the Lucide icon (shown on default theme)
}

export default function NeonIcon({ name, size = 16, className = "", children }: Props) {
  const theme = useThemeStore((s) => s.theme);
  if (theme === "default") return children ?? null;

  const entry = (iconData as unknown as Record<string, [string, string]>)[name];
  if (!entry) return children ?? null;

  const [colorClass, svgInner] = entry;
  const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgInner}</svg>`;

  return (
    <span
      className={`neon-icon ${colorClass} ${className}`}
      style={{ width: size, height: size, fontSize: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
