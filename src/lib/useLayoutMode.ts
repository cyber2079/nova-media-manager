import { useState, useEffect, useCallback } from "react";
import { kv } from "@/lib/sqliteStore";
import type { LayoutMode } from "@/components/LayoutSwitch";

export function useLayoutMode(key: string, fallback: LayoutMode = "card"): [LayoutMode, (m: LayoutMode) => void] {
  const [mode, setMode] = useState<LayoutMode>(() =>
    (localStorage.getItem(key) as LayoutMode) || fallback
  );

  useEffect(() => {
    // On mount, load from SQLite (may override localStorage cached value)
    kv.get(key).then((raw) => {
      if (raw === "list" || raw === "card" || raw === "small" || raw === "banner") {
        setMode(raw as LayoutMode);
      }
    });
  }, [key]);

  useEffect(() => {
    localStorage.setItem(key, mode);
    kv.set(key, mode).catch(() => {});
  }, [mode, key]);

  return [mode, setMode];
}
