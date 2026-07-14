import { useEffect } from "react";

/**
 * Production security hardening — blocks F12, context menu, drag-to-save.
 * Dev mode (.env VITE_LICENSE_TIER) completely skips all blocks.
 */
export function useSecurity() {
  useEffect(() => {
    if ((import.meta as any).env?.VITE_LICENSE_TIER) return;

    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);

    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === "F12") e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "I") e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.key === "u") e.preventDefault();
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
