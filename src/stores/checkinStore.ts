// ── 签到活跃系统 ──
// 前端 store：每日自动签入、统计展示、里程碑领取

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ── Types (mirrors Rust CheckInStats / MilestoneDef) ──

export interface MilestoneDef {
  days: number;
  rewardDays: number;
  claimed: boolean;
}

export interface CheckInStats {
  activeDays: number;
  streakDays: number;
  todayChecked: boolean;
  todayPlayCount: number;
  tier: string;
  claimedMilestones: number[];
  milestones: MilestoneDef[];
}

export interface LicenseInfo {
  tier: string;
  duration: string;
  expiresAt: string | null;
  maxDevices: number;
  deviceName?: string;
  activatedAt?: string;
}

interface CheckInState {
  stats: CheckInStats | null;
  loading: boolean;
  redeeming: number | null; // milestone days being redeemed

  init: () => Promise<void>;
  redeem: (milestone: number) => Promise<string | null>; // null=ok, string=error
}

export const useCheckInStore = create<CheckInState>((set, get) => ({
  stats: null,
  loading: false,
  redeeming: null,

  init: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const stats = await invoke<CheckInStats>("auto_checkin");
      set({ stats, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  redeem: async (milestone: number) => {
    set({ redeeming: milestone });
    try {
      await invoke<LicenseInfo>("redeem_milestone", { milestone });
      // Refresh stats after successful redeem
      const stats = await invoke<CheckInStats>("get_checkin_stats");
      set({ stats, redeeming: null });
      return null;
    } catch (e) {
      set({ redeeming: null });
      return String(e);
    }
  },
}));
