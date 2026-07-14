/**
 * Minimal layout for the secondary display — no header, no footer, no nav.
 * Full viewport canvas for the media artwork / visualizer / lyrics.
 */
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useThemeStore, type ThemeName } from "@/stores/themeStore";

export default function SecondaryLayout() {
  const theme = useThemeStore((s) => s.theme);

  // Sync data-theme attribute from shared Zustand store
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-[#080c14] text-white overflow-hidden">
      <Outlet />
    </div>
  );
}
