import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

const SERVER_URL = "https://scm-think.cn";

export interface LicenseInfo {
  tier: "free" | "member" | "pro";
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

/** Dev mode override — set VITE_LICENSE_TIER in .env to bypass activation */
function devLicense(): LicenseInfo | null {
  const tier = import.meta.env?.VITE_LICENSE_TIER as string | undefined;
  if (!tier || tier === "free") return null;
  return {
    tier: tier as "member" | "pro",
    duration: "permanent",
    expiresAt: null,
    maxDevices: 99,
    deviceName: "dev-machine",
  };
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  license: devLicense() ?? { ...FREE_LICENSE },
  loaded: false,
  activationOpen: false,

  init: async () => {
    // Dev override wins — no backend call needed
    const dev = devLicense();
    if (dev) { set({ license: dev, loaded: true }); return; }

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

  unbind: async () => {
    await invoke("unbind_license");
    set({
      license: { ...FREE_LICENSE },
    });
  },

  openActivation: () => set({ activationOpen: true }),
  closeActivation: () => set({ activationOpen: false }),
}));

/** Helper: is any paid tier? (member or pro) */
export function isPaid(tier: string): boolean {
  return tier === "member" || tier === "pro";
}

/** @deprecated use isPaid */
export function isPro(tier: string): boolean {
  return tier === "member" || tier === "pro";
}

/** Helper: is Pro tier? */
export function isProTier(tier: string): boolean {
  return tier === "pro";
}
