import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface LicenseInfo {
  tier: "free" | "pro" | "ultra" | "custom";
  duration: "yearly" | "permanent";
  expiresAt: string | null;
  maxDevices: number;
  deviceName?: string;
}

interface LicenseState {
  /** Current license info (defaults to "free" if not activated) */
  license: LicenseInfo;
  /** Whether we've finished loading from local storage */
  loaded: boolean;
  /** Whether activation UI is open */
  activationOpen: boolean;

  // Actions
  init: () => Promise<void>;
  activate: (code: string, deviceName?: string) => Promise<LicenseInfo>;
  check: () => Promise<LicenseInfo>;
  openActivation: () => void;
  closeActivation: () => void;
}

const FREE_LICENSE: LicenseInfo = {
  tier: "free",
  duration: "permanent",
  expiresAt: null,
  maxDevices: 1,
};

export const useLicenseStore = create<LicenseState>((set, get) => ({
  license: { ...FREE_LICENSE },
  loaded: false,
  activationOpen: false,

  init: async () => {
    try {
      const info = await invoke<LicenseInfo>("get_license");
      set({ license: info, loaded: true });
    } catch {
      set({ license: { ...FREE_LICENSE }, loaded: true });
    }
  },

  activate: async (code: string, deviceName?: string) => {
    const info = await invoke<LicenseInfo>("activate_license", { code, deviceName });
    set({ license: info, activationOpen: false });
    return info;
  },

  check: async () => {
    try {
      const info = await invoke<LicenseInfo>("check_license");
      set({ license: info });
      return info;
    } catch (err) {
      console.warn("[license] check failed:", err);
      return get().license;
    }
  },

  openActivation: () => set({ activationOpen: true }),
  closeActivation: () => set({ activationOpen: false }),
}));

/** Helper: is the current license Pro or higher? */
export function isPro(tier: string): boolean {
  return tier === "pro" || tier === "ultra" || tier === "custom";
}

/** Helper: is the current license Ultra or higher? */
export function isUltra(tier: string): boolean {
  return tier === "ultra" || tier === "custom";
}
