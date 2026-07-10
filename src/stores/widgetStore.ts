import { create } from "zustand";
import { kv } from "@/lib/sqliteStore";

export type WidgetPosition = "top-left" | "top-right" | "center-left" | "center-right" | "bottom-left" | "bottom-right";

export type MyComputerMode = "default" | "custom";

export const pageKeys = ["home", "movies", "images", "music", "games"] as const;
export type PageKey = typeof pageKeys[number];

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
  globalWidgets: boolean;
  widgetPages: Record<PageKey | string, boolean>;

  init: () => Promise<void>;
  setEnabled: (id: string, on: boolean) => void;
  setPosition: (id: string, pos: WidgetPosition) => void;
  setIcon: (id: string, path: string) => void;
  setLabel: (id: string, label: string) => void;
  setAppPath: (id: string, path: string) => void;
  setMyComputerMode: (mode: MyComputerMode) => void;
  setGlobalWidgets: (on: boolean) => void;
  setPageWidget: (page: PageKey, on: boolean) => void;
  isWidgetVisible: (page: PageKey) => boolean;
  setCountdown: (cfg: Partial<CountdownConfig>) => void;
}

const KEY = "app-widgets";

function loadLocal(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

function defaultPages(): Record<PageKey, boolean> {
  return { home: true, movies: false, images: false, music: false, games: false };
}

async function persist(state: WidgetState) {
  const payload = JSON.stringify({
    myComputer: state.myComputer, systemMonitor: state.systemMonitor,
    clock: state.clock, calendar: state.calendar,
    countdown: state.countdown,
    globalWidgets: state.globalWidgets,
    widgetPages: state.widgetPages,
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
    calendar: def("calendar", { enabled: saved.calendar?.enabled || false, position: saved.calendar?.position || "top-right", label: "" }),
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

    globalWidgets: saved.globalWidgets !== false,
    widgetPages: { ...defaultPages(), ...(saved.widgetPages || {}) },

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
            globalWidgets: s.globalWidgets ?? prev.globalWidgets,
            widgetPages: { ...prev.widgetPages, ...(s.widgetPages || {}) },
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
        const state = { ...s, [key]: next };
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

    setGlobalWidgets(on) {
      set((s) => {
        const st = { ...s, globalWidgets: on };
        if (on) st.widgetPages = { ...st.widgetPages, home: true, movies: true, images: true, music: true, games: true };
        persist(st);
        return st;
      });
    },

    setPageWidget(page, on) {
      set((s) => {
        const next = { ...s.widgetPages, [page]: on };
        const st = { ...s, widgetPages: next };
        persist(st);
        return st;
      });
    },

    isWidgetVisible(page) {
      const s = get();
      if (s.globalWidgets) return true;
      return !!s.widgetPages[page];
    },

    setCountdown(cfg) {
      set((s) => {
        const next = { ...s.countdown, ...cfg };
        const st = { ...s, countdown: next };
        persist(st);
        return st;
      });
    },
  };
});
