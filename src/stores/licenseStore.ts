import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

const SERVER_URL = "https://scm-think.cn";

export interface LicenseInfo {
  tier: "free" | "member";
  duration: "monthly" | "yearly" | "permanent";
  expiresAt: string | null;
  /** ISO timestamp of when the license was first activated on this device */
  activatedAt?: string;
  maxDevices: number;
  deviceName?: string;
  /** Activation code (masked by default in settings) */
  code?: string;
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

/** Dev mode override — set VITE_LICENSE_TIER=member in .env to bypass activation.
 *  Preserves activatedAt across app restarts via localStorage so it doesn't drift. */
function devLicense(): LicenseInfo | null {
  const tier = import.meta.env?.VITE_LICENSE_TIER as string | undefined;
  if (!tier || tier === "free") return null;
  const STORAGE_KEY = "dev-license-activated-at";
  let activatedAt = localStorage.getItem(STORAGE_KEY);
  if (!activatedAt) {
    activatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, activatedAt);
  }
  return {
    tier: "member",
    duration: "yearly",
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    maxDevices: 1,
    deviceName: "dev-machine",
    activatedAt,
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

/** Helper: is paid member? */
export function isPaid(tier: string): boolean {
  return tier === "member";
}
