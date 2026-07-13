import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

const SERVER_URL = "https://scm-think.cn";

export interface LicenseInfo {
  tier: "free" | "pro" | "ultra" | "custom";
  duration: "monthly" | "yearly" | "permanent";
  expiresAt: string | null;
  activatedAt?: string;
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
  unbind: () => Promise<void>;
  openActivation: () => void;
  closeActivation: () => void;
}

const FREE_LICENSE: LicenseInfo = {
  tier: "free",
  duration: "permanent",
  expiresAt: null,
  maxDevices: 1,
};

/** Local dev override: set VITE_LICENSE_TIER=pro in .env to skip activation. */
const DEV_LICENSE: LicenseInfo = {
  tier: "pro",
  duration: "permanent",
  expiresAt: null,
  maxDevices: 1,
};

const isDevPro = import.meta.env.VITE_LICENSE_TIER === "pro";

export const useLicenseStore = create<LicenseState>((set, get) => ({
  license: isDevPro ? { ...DEV_LICENSE } : { ...FREE_LICENSE },
  loaded: false,
  activationOpen: false,

  init: async () => {
    try {
      const info = await invoke<LicenseInfo>("get_license");
      // Dev mode: if no license activated, auto-grant Pro for theme development
      if (info.tier === "free" && isDevPro) {
        set({ license: { ...DEV_LICENSE }, loaded: true });
        return;
      }
      set({ license: info, loaded: true });
    } catch {
      // Dev mode fallback
      if (isDevPro) {
        set({ license: { ...DEV_LICENSE }, loaded: true });
      } else {
        set({ license: { ...FREE_LICENSE }, loaded: true });
      }
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

  unbind: async () => {
    await invoke("unbind_license");
    set({
      license: { ...FREE_LICENSE },
    });
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
