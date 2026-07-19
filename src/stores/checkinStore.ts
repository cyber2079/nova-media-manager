// ── 签到系统（纯统计，无兑换）──

import { useSyncExternalStore, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// ── Types ──

export interface CheckInStats {
  activeDays: number;
  totalActiveDays: number;
  streakDays: number;
  todayChecked: boolean;
  todayPlayCount: number;
  tier: string;
}

// ── Global store ──
type GCache = { stats: CheckInStats | null; listeners: Set<() => void>; pending: boolean };
const w = window as any;
const g: GCache = w.__ci || (w.__ci = { stats: null, listeners: new Set(), pending: false });

async function doLoad() {
  g.pending = true;
  try {
    g.stats = await invoke<CheckInStats>("auto_checkin");
  } catch {
    try {
      g.stats = await invoke<CheckInStats>("get_checkin_stats");
    } catch {}
  }
  g.pending = false;
  g.listeners.forEach((fn) => fn());
}

export function useCheckInStats(): CheckInStats | null {
  const stats = useSyncExternalStore<CheckInStats | null>(
    (cb) => {
      g.listeners.add(cb);
      if (g.stats) cb();
      return () => { g.listeners.delete(cb); };
    },
    () => g.stats,
  );

  useEffect(() => {
    if (!g.stats && !g.pending) doLoad();
  }, []);

  return stats;
}
