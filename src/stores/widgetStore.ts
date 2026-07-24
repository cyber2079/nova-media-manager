import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";

export type WidgetPosition = "top-left" | "top-right" | "center-left" | "center-right" | "bottom-left" | "bottom-right";

export type MyComputerMode = "default" | "custom";

export interface WidgetConfig {
  id: string;
  enabled: boolean;
  position: WidgetPosition;
  iconPath: string;
  label: string;
  appPath: string;
  myComputerMode?: MyComputerMode;
}

export interface CountdownConfig {
  enabled: boolean;
  position: WidgetPosition;
  displayMode: "mini" | "full";
  hours: number;
  minutes: number;
  seconds: number;
  loopCount: number;    // 0=无限
  alertGlow: boolean;
  alertVoice: boolean;
  voiceInterval: number; // seconds between voice repeats, minimum 30
  // alertPopup is always on — cannot be turned off
}

interface WidgetState {
  myComputer: WidgetConfig;
  systemMonitor: WidgetConfig;
  clock: WidgetConfig;
  calendar: WidgetConfig;
  countdown: CountdownConfig;

  widgetCustomPos: Record<string, { x: number; y: number }>;
  widgetLocked: Record<string, boolean>;

  init: () => Promise<void>;
  setEnabled: (id: string, on: boolean) => void;
  setPosition: (id: string, pos: WidgetPosition) => void;
  setIcon: (id: string, path: string) => void;
  setLabel: (id: string, label: string) => void;
  setAppPath: (id: string, path: string) => void;
  setMyComputerMode: (mode: MyComputerMode) => void;
  setCountdown: (cfg: Partial<CountdownConfig>) => void;
  setWidgetPos: (id: string, x: number, y: number) => void;
  setWidgetLocked: (id: string, locked: boolean) => void;
}

const KEY = "app-widgets";

function loadLocal(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

async function persist(state: WidgetState) {
  const payload = JSON.stringify({
    myComputer: state.myComputer, systemMonitor: state.systemMonitor,
    clock: state.clock, calendar: state.calendar,
    countdown: state.countdown,
    widgetCustomPos: state.widgetCustomPos,
    widgetLocked: state.widgetLocked,
  });
  localStorage.setItem(KEY, payload);
  await kv.set(KEY, payload).catch(() => {});
}

function def(id: string, defaults: Partial<WidgetConfig>): WidgetConfig {
  return { id, enabled: false, position: "bottom-right", iconPath: "", label: "", appPath: "", ...defaults };
}

export const useWidgetStore = create<WidgetState>((set, get) => {
  const saved = loadLocal();

  return {
    myComputer: def("myComputer", { enabled: saved.myComputer?.enabled || false, position: saved.myComputer?.position || "bottom-left", label: saved.myComputer?.label || "我的电脑", appPath: saved.myComputer?.appPath || "::{20D04FE0-3AEA-1069-A2D8-08002B30309D}", iconPath: saved.myComputer?.iconPath || "", myComputerMode: saved.myComputer?.myComputerMode || "default" }),
    systemMonitor: def("systemMonitor", { enabled: saved.systemMonitor?.enabled || false, position: saved.systemMonitor?.position || "bottom-right" }),
    clock: def("clock", { enabled: saved.clock?.enabled || false, position: saved.clock?.position || "top-right", label: "" }),
    calendar: def("calendar", { enabled: saved.calendar?.enabled || false, position: saved.calendar?.position || "top-left", label: "" }),
    widgetCustomPos: (saved as any).widgetCustomPos || {},
    widgetLocked: (saved as any).widgetLocked || {},
    countdown: {
      enabled: saved.countdown?.enabled ?? false,
      position: (saved.countdown?.position as WidgetPosition) || "center-right",
      displayMode: (saved.countdown?.displayMode as "mini" | "full") || "full",
      hours: saved.countdown?.hours ?? 0,
      minutes: saved.countdown?.minutes ?? 5,
      seconds: saved.countdown?.seconds ?? 0,
      loopCount: saved.countdown?.loopCount ?? 1,
      alertGlow: saved.countdown?.alertGlow ?? false,
      alertVoice: saved.countdown?.alertVoice ?? true,
      voiceInterval: saved.countdown?.voiceInterval ?? 30,
    },

    init: async () => {
      const raw = await kv.get(KEY);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          set((prev) => ({
            myComputer: def("myComputer", { ...prev.myComputer, ...(s.myComputer || {}) }),
            systemMonitor: def("systemMonitor", { ...prev.systemMonitor, ...(s.systemMonitor || {}) }),
            clock: def("clock", { ...prev.clock, ...(s.clock || {}) }),
            calendar: def("calendar", { ...prev.calendar, ...(s.calendar || {}) }),
            countdown: { ...prev.countdown, ...(s.countdown || {}) },
          }));
        } catch {}
      }
    },

    setEnabled(id, on) {
      set((s) => {
        const key = id as keyof Pick<WidgetState, "myComputer" | "systemMonitor" | "clock" | "calendar">;
        const next = { ...s[key], enabled: on } as WidgetConfig;
        const state = { ...s, [key]: next };
        persist(state);
        return state;
      });
    },

    setPosition(id, pos) {
      set((s) => {
        const key = id as keyof Pick<WidgetState, "myComputer" | "systemMonitor" | "clock" | "calendar">;
        const next = { ...s[key], position: pos } as WidgetConfig;
        // Clear custom position so preset takes effect
        const newCustomPos = { ...s.widgetCustomPos };
        delete newCustomPos[id];
        const state = { ...s, [key]: next, widgetCustomPos: newCustomPos };
        persist(state);
        return state;
      });
    },

    setIcon(id, path) {
      set((s) => {
        const key = id as keyof Pick<WidgetState, "myComputer" | "systemMonitor" | "clock" | "calendar">;
        const next = { ...s[key], iconPath: path } as WidgetConfig;
        const st = { ...s, [key]: next }; persist(st); return st;
      });
    },

    setLabel(id, label) {
      set((s) => {
        const key = id as keyof Pick<WidgetState, "myComputer" | "systemMonitor" | "clock" | "calendar">;
        const next = { ...s[key], label } as WidgetConfig;
        const st = { ...s, [key]: next }; persist(st); return st;
      });
    },

    setAppPath(id, path) {
      set((s) => {
        const key = id as keyof Pick<WidgetState, "myComputer" | "systemMonitor" | "clock" | "calendar">;
        const next = { ...s[key], appPath: path } as WidgetConfig;
        const st = { ...s, [key]: next }; persist(st); return st;
      });
    },

    setMyComputerMode(mode: MyComputerMode) {
      set((s) => { const n = { ...s.myComputer, myComputerMode: mode }; const st = { ...s, myComputer: n }; persist(st); return st; });
    },

    setCountdown(cfg) {
      set((s) => {
        const next = { ...s.countdown, ...cfg };
        // If displayMode changed, clear custom position so widget re-centers
        const newCustomPos = cfg.displayMode && cfg.displayMode !== s.countdown.displayMode
          ? { ...s.widgetCustomPos, countdown: undefined as any }
          : s.widgetCustomPos;
        const st = { ...s, countdown: next, widgetCustomPos: newCustomPos };
        persist(st);
        return st;
      });
    },

    setWidgetPos(id, x, y) {
      set((s) => {
        const st = { ...s, widgetCustomPos: { ...s.widgetCustomPos, [id]: { x, y } } };
        persist(st as any);
        return st;
      });
    },

    setWidgetLocked(id, locked) {
      set((s) => {
        const st = { ...s, widgetLocked: { ...s.widgetLocked, [id]: locked } };
        persist(st as any);
        return st;
      });
    },
  };
});
