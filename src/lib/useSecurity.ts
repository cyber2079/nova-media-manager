import { useEffect } from "react";

/**
 * Security hardening — blocks F12, context menu, drag-out.
 * Dev mode skips key blocks but NOT drag prevention.
 */
export function useSecurity() {
  useEffect(() => {
    if ((import.meta as any).env?.VITE_LICENSE_TIER) {
      // Dev mode: only block drag-out; skip F12/context-menu/key blocks
      const blockDrag = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };
      document.addEventListener("dragstart", blockDrag, true);
      return () => document.removeEventListener("dragstart", blockDrag, true);
    }

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
