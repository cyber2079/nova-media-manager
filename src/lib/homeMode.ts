import { useState, useEffect } from "react";

// Shared state for default-theme home page mode:
// "strip" = compact MediaStrip at bottom (wallpaper visible)
// "full"  = full DashBoard in center (original layout)

const KEY = "home-dashboard-mode";
type Mode = "strip" | "full";

let _mode: Mode = (localStorage.getItem(KEY) as Mode) || "strip";
let _listeners: Array<() => void> = [];

export function getHomeMode(): Mode {
  return _mode;
}

export function setHomeMode(m: Mode) {
  if (_mode === m) return;
  _mode = m;
  localStorage.setItem(KEY, m);
  _listeners.forEach((fn) => fn());
}

export function useHomeMode() {
  const [mode, setMode] = useState<Mode>(_mode);
  useEffect(() => {
    const fn = () => setMode(_mode);
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
    };
  }, []);
  return [mode, setHomeMode] as const;
}
