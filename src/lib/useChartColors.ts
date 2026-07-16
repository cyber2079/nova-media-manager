// ── 主题色解析 ──
// Recharts/SVG 的 fill 走属性，presentation attribute 不解析 var()（时钟组件踩过的坑），
// 所以把 CSS 变量解析成具体色值传给图表，并监听主题切换/调色实时重读。

import { useEffect, useState } from "react";

export interface ChartColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  fontPrimary: string;
  fontSecondary: string;
}

function readColors(): ChartColors {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string, fb: string) => (cs.getPropertyValue(n) || "").trim() || fb;
  return {
    primary: get("--color-primary", "#4788f0"),
    primaryLight: get("--color-primary-light", "#7aafff"),
    primaryDark: get("--color-primary-dark", "#3366cc"),
    accent: get("--color-accent", "#6366f1"),
    fontPrimary: get("--font-primary", "#ffffff"),
    fontSecondary: get("--font-secondary", "#8899aa"),
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(readColors);
  useEffect(() => {
    // data-theme 切换 / 自定义调色都会改 html 的属性或内联 style
    const obs = new MutationObserver(() => setColors(readColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style", "data-custom-theme"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}

/** hex + 透明度 → rgba 字符串（热力图分级用） */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
