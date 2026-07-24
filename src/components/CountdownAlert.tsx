import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/stores/themeStore";

interface AlertConfig { active: boolean; glow: boolean; voice: boolean; voiceInterval: number; }

// ── Shared AudioContext ──
let _ctx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

/** Play a melody — array of {note, time(ms), length(ms), vol} */
function playPhrase(c: AudioContext, notes: Array<{ freq: number; start: number; len: number; vol: number; type?: OscillatorType }>) {
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type || "sine";
    osc.frequency.value = n.freq;
    const t = now + n.start / 1000;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(n.vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + n.len / 1000);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + n.len / 1000 + 0.02);
  }
}

// ═══════════ Default — 柔和循环 chime（风铃渐次响起）═══════════
const DEFAULT_MELODY = [
  { freq: 523, start: 0, len: 500, vol: 0.05 },
  { freq: 659, start: 600, len: 500, vol: 0.06 },
  { freq: 784, start: 1200, len: 600, vol: 0.07 },
  { freq: 1047, start: 1900, len: 800, vol: 0.08 },
];
const DEFAULT_CYCLE = 3000; // ms

let _defaultTimer: ReturnType<typeof setInterval> | null = null;
function startDefaultLoop() {
  stopDefaultLoop();
  const c = ctx();
  playPhrase(c, DEFAULT_MELODY);
  _defaultTimer = setInterval(() => playPhrase(c, DEFAULT_MELODY), DEFAULT_CYCLE);
}
function stopDefaultLoop() {
  if (_defaultTimer) { clearInterval(_defaultTimer); _defaultTimer = null; }
}

// ═══════════ Cyberpunk — 城市霓虹小调（轻快菱形波，琶音上下行）═══════════
const CYBERPUNK_MELODY = [
  { freq: 523, start: 0, len: 180, vol: 0.05, type: "triangle" as const },
  { freq: 659, start: 200, len: 180, vol: 0.05, type: "triangle" as const },
  { freq: 784, start: 400, len: 180, vol: 0.06, type: "triangle" as const },
  { freq: 1047, start: 600, len: 250, vol: 0.06, type: "triangle" as const },
  { freq: 784, start: 900, len: 200, vol: 0.05, type: "triangle" as const },
  { freq: 659, start: 1100, len: 200, vol: 0.05, type: "triangle" as const },
  { freq: 523, start: 1300, len: 300, vol: 0.06, type: "triangle" as const },
];
const CYBERPUNK_CYCLE = 1700;

let _cyberpunkTimer: ReturnType<typeof setInterval> | null = null;
let _gridTimer: ReturnType<typeof setInterval> | null = null;
function stopThemeLoop() {
  if (_cyberpunkTimer) { clearInterval(_cyberpunkTimer); _cyberpunkTimer = null; }
  if (_gridTimer) { clearInterval(_gridTimer); _gridTimer = null; }
}

// ═══════════ Cyber-Grid — 蓝图扫描线（清脆方波，科技感阶进音阶）═══════════
const GRID_MELODY = [
  { freq: 988, start: 0, len: 120, vol: 0.06, type: "square" as const },
  { freq: 880, start: 160, len: 120, vol: 0.06, type: "square" as const },
  { freq: 784, start: 320, len: 120, vol: 0.06, type: "square" as const },
  { freq: 659, start: 480, len: 120, vol: 0.06, type: "square" as const },
  { freq: 523, start: 640, len: 120, vol: 0.06, type: "square" as const },
  { freq: 659, start: 800, len: 120, vol: 0.06, type: "square" as const },
  { freq: 784, start: 960, len: 120, vol: 0.06, type: "square" as const },
  { freq: 988, start: 1120, len: 200, vol: 0.08, type: "square" as const },
];
const GRID_CYCLE = 1400;

// ── Component ──
export default function CountdownAlert() {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [cfg, setCfg] = useState<AlertConfig | null>(null);
  const hasAlertedRef = useRef(false);

  useEffect(() => {
    const onAlert = () => {
      const c = (window as any).__countdownAlert as AlertConfig | undefined;
      if (c && !hasAlertedRef.current) {
        hasAlertedRef.current = true;
        setCfg({ ...c });
      }
    };
    window.addEventListener("countdown-alert", onAlert);
    return () => window.removeEventListener("countdown-alert", onAlert);
  }, []);

  useEffect(() => {
    if (!cfg || !cfg.voice) return;
    if (theme === "cyber-grid") {
      playPhrase(ctx(), GRID_MELODY);
      _gridTimer = setInterval(() => playPhrase(ctx(), GRID_MELODY), GRID_CYCLE);
    } else if (theme === "cyberpunk") {
      playPhrase(ctx(), CYBERPUNK_MELODY);
      _cyberpunkTimer = setInterval(() => playPhrase(ctx(), CYBERPUNK_MELODY), CYBERPUNK_CYCLE);
    } else {
      startDefaultLoop();
    }
    return () => { stopDefaultLoop(); stopThemeLoop(); };
  }, [cfg, theme]);

  const dismiss = useCallback(() => {
    stopDefaultLoop();
    stopThemeLoop();
    setCfg(null);
    hasAlertedRef.current = false;
    window.dispatchEvent(new CustomEvent("countdown-dismissed"));
  }, []);

  if (!cfg) return null;

  const isZh = i18n.language.startsWith("zh");
  const isTheme = theme === "cyberpunk" || theme === "cyber-grid";
  const desc = theme === "cyber-grid"
    ? (isZh ? "🎵 蓝图扫描线循环中，点击确认停止" : "🎵 Blueprint scan chime — click to stop")
    : theme === "cyberpunk"
    ? (isZh ? "🎵 霓虹小调循环中，点击确认停止" : "🎵 Neon chime — click to stop")
    : (isZh ? "🎵 柔和提示音循环中，点击确认停止" : "🎵 Gentle chime — click to stop");

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center select-none">
      {cfg.glow && (
        <div className="absolute inset-0 animate-pulse"
          style={{ background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 25%, transparent) 0%, transparent 70%)", animationDuration: "1.5s" }} />
      )}
      <div className="relative z-10 bg-surface-light/98 backdrop-blur-xl border border-primary/40 rounded-2xl shadow-2xl px-10 py-8 w-[620px] max-w-[90vw] mx-4 text-center space-y-6">
        <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: "var(--font-primary)" }}>
          {isZh ? "倒计时结束" : "Countdown finished"}
        </p>
        <p className="text-xs text-gray-500">{desc}</p>
        <button onClick={dismiss}
          className="px-8 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium">
          {isZh ? "我知道了" : "I Understand"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
