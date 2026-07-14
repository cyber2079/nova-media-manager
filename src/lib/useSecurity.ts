import { useEffect } from "react";

/**
 * Production security hardening — blocks F12 inspection shortcuts,
 * right-click context menu, and drag-to-save image extraction.
 *
 * Dev mode (.env VITE_LICENSE_TIER=pro) skips all blocks.
 */
export function useSecurity() {
  useEffect(() => {
    // Dev mode — keep all tools accessible
    if (import.meta.env.VITE_LICENSE_TIER === "pro") return;

    const block = (e: Event) => e.preventDefault();

    // Block right-click (save image, inspect element)
    document.addEventListener("contextmenu", block);

    // Block drag (drag image to desktop)
    document.addEventListener("dragstart", block);

    // Block common devtools shortcuts
    const blockKeys = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") e.preventDefault();
      // Ctrl+Shift+I / Cmd+Option+I (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "I") e.preventDefault();
      // Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === "u") e.preventDefault();
      // Ctrl+S (Save Page)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") e.preventDefault();
    };
    document.addEventListener("keydown", blockKeys, true);

    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", blockKeys, true);
    };
  }, []);
}
