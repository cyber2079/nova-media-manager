import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import DesktopWidget from "@/components/DesktopWidget";
import { useWidgetStore, type CountdownConfig } from "@/stores/widgetStore";
import { Play, Pause, RotateCcw, Settings, X } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { cn } from "@/lib/utils";
function fmtTime(h: number, m: number, s: number): string {
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CountdownWidget({ config }: { config: CountdownConfig }) {
  const { t } = useTranslation();
  const setCountdown = useWidgetStore((s) => s.setCountdown);
  const isMini = config.displayMode === "mini";

  const [displaySec, setDisplaySec] = useState(config.hours * 3600 + config.minutes * 60 + config.seconds);
  const [floatRemain, setFloatRemain] = useState(config.hours * 3600 + config.minutes * 60 + config.seconds);

  const [running, setRunning] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const [loopRemaining, setLoopRemaining] = useState(config.loopCount);
  const [panelOpen, setPanelOpen] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startStampRef = useRef<number>(0);
  const totalSecRef = useRef<number>(0);
  const pauseStampRef = useRef<number>(0);
  const pausedOffsetRef = useRef<number>(0);
  const alertFiredRef = useRef(false);

  const [h, setH] = useState(config.hours);
  const [m, setM] = useState(config.minutes);
  const [s, setS] = useState(config.seconds);
  const [loops, setLoops] = useState(config.loopCount);
  const [glow, setGlow] = useState(config.alertGlow);
  const [voice, setVoice] = useState(config.alertVoice);

  useEffect(() => {
    if (running) return;
    setH(config.hours);
    setM(config.minutes);
    setS(config.seconds);
    setLoops(config.loopCount);
    setGlow(config.alertGlow);
    setVoice(config.alertVoice);
    const ts = config.hours * 3600 + config.minutes * 60 + config.seconds;
    setDisplaySec(ts);
    setFloatRemain(ts);
  }, [config.hours, config.minutes, config.seconds, config.loopCount, config.alertGlow, config.alertVoice, running]);

  const totalBase = config.hours * 3600 + config.minutes * 60 + config.seconds;
  const alertConfigRef = useRef({ glow: config.alertGlow, voice: config.alertVoice, voiceInterval: config.voiceInterval ?? 30 });

  const fireAlert = useCallback(() => {
    if (alertFiredRef.current) return;
    alertFiredRef.current = true;
    setRunning(false);
    setAlerting(true);
    (window as any).__countdownAlert = {
      active: true,
      glow: alertConfigRef.current.glow,
      voice: alertConfigRef.current.voice,
      voiceInterval: alertConfigRef.current.voiceInterval ?? 30,
    };
    window.dispatchEvent(new CustomEvent("countdown-alert"));
  }, []);

  useEffect(() => {
    if (!running) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }

    const tickRAF = () => {
      const now = performance.now();
      const elapsedMs = now - startStampRef.current - pausedOffsetRef.current;
      const totalMs = totalSecRef.current * 1000;
      const remainFloat = Math.max(0, (totalMs - elapsedMs) / 1000);

      setFloatRemain(remainFloat);
      setDisplaySec(Math.floor(remainFloat));

      if (remainFloat <= 0) { fireAlert(); return; }

      rafRef.current = requestAnimationFrame(tickRAF);
    };

    rafRef.current = requestAnimationFrame(tickRAF);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, fireAlert]);

  const start = () => {
    const totalSecs = h * 3600 + m * 60 + s;
    if (totalSecs <= 0) return;
    setCountdown({ hours: h, minutes: m, seconds: s, loopCount: loops, alertGlow: glow, alertVoice: voice });
    alertConfigRef.current = { glow, voice, voiceInterval: config.voiceInterval ?? 30 };
    alertFiredRef.current = false;
    totalSecRef.current = totalSecs;
    const now = performance.now();
    if (pauseStampRef.current > 0) {
      pausedOffsetRef.current += now - pauseStampRef.current;
    } else {
      startStampRef.current = now;
      pausedOffsetRef.current = 0;
    }
    setLoopRemaining(loops);
    setRunning(true);
    setPanelOpen(false);
  };

  const pause = () => { pauseStampRef.current = performance.now(); setRunning(false); };

  const reset = () => {
    setRunning(false); setAlerting(false);
    alertFiredRef.current = false;
    pauseStampRef.current = 0; pausedOffsetRef.current = 0;
    const ts = config.hours * 3600 + config.minutes * 60 + config.seconds;
    setDisplaySec(ts); setFloatRemain(ts);
    setLoopRemaining(config.loopCount);
  };

  useEffect(() => {
    const onDismiss = () => {
      setAlerting(false); alertFiredRef.current = false;
      pauseStampRef.current = 0; pausedOffsetRef.current = 0;
      if (config.loopCount === 0 || loopRemaining > 1) {
        const ts = config.hours * 3600 + config.minutes * 60 + config.seconds;
        totalSecRef.current = ts;
        startStampRef.current = performance.now();
        setDisplaySec(ts); setFloatRemain(ts);
        if (config.loopCount > 0) setLoopRemaining((l) => l - 1);
        setRunning(true);
      } else { setRunning(false); }
    };
    window.addEventListener("countdown-dismissed", onDismiss);
    return () => window.removeEventListener("countdown-dismissed", onDismiss);
  }, [config, loopRemaining]);

  const progress = totalBase > 0 ? floatRemain / totalBase : 0;
  const mins = Math.floor(displaySec / 60);
  const secs = displaySec % 60;

  return (
    <DesktopWidget position={config.position}>
      {isMini ? (
        <div className="relative" style={{ width: 40, height: 40 }}>
          <svg className="absolute inset-0 pointer-events-none" width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="20" cy="20" r="17" fill="none"
              stroke="var(--color-surface-lighter)" strokeWidth="2" />
            <circle cx="20" cy="20" r="17" fill="none"
              stroke="var(--color-primary-light)" strokeWidth="2" strokeLinecap="round"
              strokeDasharray={106.814}
              strokeDashoffset={106.814 * (1 - progress * (running ? 1 : 0))}
              style={{ filter: `drop-shadow(0 0 3px var(--color-primary-light))` }} />
          </svg>
          <button onClick={running ? pause : start} title={running ? t("widget.countdown_pause") : t("widget.countdown_start_title")}
            className="absolute inset-0 flex items-center justify-center rounded-full transition-all duration-200">
            {running
              ? <NeonIcon name="Pause" size={16}><Pause className="h-3 w-3" style={{ color: "var(--font-widget)" }} /></NeonIcon>
              : <NeonIcon name="Play" size={16}><Play className="h-3 w-3 ml-0.5" style={{ color: "var(--font-widget)" }} /></NeonIcon>}
          </button>
        </div>
      ) : (
        <div className="bg-surface-light/95 backdrop-blur-md border border-primary/30 rounded-xl shadow-xl select-none"
          style={{ padding: panelOpen ? "8px 12px 8px 12px" : "8px 12px 8px 12px" }}>
          {!panelOpen ? (
            <CompactDisplay t={t} running={running} remaining={fmtTime(config.hours, mins, secs)} progress={progress}
              start={start} pause={pause} reset={reset} setPanel={() => setPanelOpen(true)} totalSecs={h*3600+m*60+s} />
          ) : (
            <SettingsPanel t={t} h={h} setH={setH} m={m} setM={setM} s={s} setS={setS}
              loops={loops} setLoops={setLoops} glow={glow} setGlow={setGlow} voice={voice} setVoice={setVoice}
              config={config} setCountdown={setCountdown} start={start} close={() => setPanelOpen(false)} />
          )}
        </div>
      )}
    </DesktopWidget>
  );
}

// ── Compact display: timer + play/pause/reset + settings gear ──
function CompactDisplay({ t, running, remaining, progress, start, pause, reset, setPanel, totalSecs }: any) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 text-center">
        <span className="text-sm font-mono tabular-nums" style={{ color: "var(--font-widget)" }}>{remaining}</span>
        {running && (
          <div className="w-full h-1 bg-surface-lighter rounded-full mt-1 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, transition: "width 0.04s linear", background: "var(--color-primary-light)" }} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {!running ? (
          <button onClick={start} disabled={totalSecs <= 0} className="disabled:opacity-30 p-1" style={{ color: "var(--color-primary-light)" }} title={t("widget.countdown_start_title")}><NeonIcon name="Play" size={16}><Play className="h-3.5 w-3.5" /></NeonIcon></button>
        ) : (
          <button onClick={pause} className="p-1" style={{ color: "var(--color-primary-light)" }} title={t("widget.countdown_pause")}><NeonIcon name="Pause" size={16}><Pause className="h-3.5 w-3.5" /></NeonIcon></button>
        )}
        <button onClick={reset} className="text-gray-400 hover:text-white p-1" title={t("widget.countdown_reset")}><NeonIcon name="RotateCcw" size={16}><RotateCcw className="h-3 w-3" /></NeonIcon></button>
        <button onClick={setPanel} className="text-gray-400 hover:text-white p-1" title={t("widget.countdown_settings")}><NeonIcon name="Settings" size={16}><Settings className="h-3 w-3" /></NeonIcon></button>
      </div>
    </div>
  );
}

// ── Settings panel: all config inputs, opened by clicking gear ──
function SettingsPanel({ t, h, setH, m, setM, s, setS, loops, setLoops, glow, setGlow, voice, setVoice, config, setCountdown, start, close }: any) {
  return (
    <div className="space-y-2 min-w-[180px]">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{t("widget.countdown_title")}</span>
        <button onClick={close} className="text-gray-400 hover:text-white p-0.5"><NeonIcon name="X" size={16}><X className="h-3 w-3" /></NeonIcon></button>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-300">
        <input type="number" min="0" max="23" value={h} onChange={(e) => setH(Number(e.target.value))}
          className="w-10 text-center rounded bg-surface-lighter border border-white/5 py-0.5 text-xs text-white" /><span>{t("widget.countdown_hours")}</span>
        <input type="number" min="0" max="59" value={m} onChange={(e) => setM(Number(e.target.value))}
          className="w-10 text-center rounded bg-surface-lighter border border-white/5 py-0.5 text-xs text-white" /><span>{t("widget.countdown_minutes")}</span>
        <input type="number" min="0" max="59" value={s} onChange={(e) => setS(Number(e.target.value))}
          className="w-10 text-center rounded bg-surface-lighter border border-white/5 py-0.5 text-xs text-white" /><span>{t("widget.countdown_seconds")}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>{t("widget.countdown_loop")}</span>
        <input type="number" min="0" max="99" value={loops} onChange={(e) => setLoops(Number(e.target.value))}
          className="w-10 text-center rounded bg-surface-lighter border border-white/5 py-0.5 text-xs text-white" />
        <span>{loops === 0 ? t("widget.countdown_unlimited") : t("widget.countdown_times")}</span>
      </div>
      <div className="space-y-1 text-xs text-gray-400">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={glow} onChange={(e) => setGlow(e.target.checked)} className="accent-primary-light" />
          <span style={glow ? { color: "var(--color-primary-light)" } : undefined}>{t("widget.countdown_glow")}</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} className="accent-primary-light" />
          <span style={voice ? { color: "var(--color-primary-light)" } : undefined}>{t("widget.countdown_voice")}</span>
        </label>
        {voice && (
          <div className="flex items-center gap-1 text-xs text-gray-400 ml-4">
            <span>{t("widget.countdown_voice_interval")}</span>
            <input type="number" min="30" max="600" value={config.voiceInterval ?? 30}
              onChange={(e) => setCountdown({ voiceInterval: Math.max(30, Number(e.target.value) || 30) })}
              className="w-12 text-center rounded bg-surface-lighter border border-white/5 py-0.5 text-xs text-white" />
            <span>{t("widget.countdown_sec")}</span>
          </div>
        )}
        <p className="text-[10px] text-gray-500">{t("widget.countdown_popup_always")}</p>
      </div>
      <button onClick={start} disabled={h + m + s <= 0}
        className="w-full text-xs py-1.5 rounded hover:opacity-90 disabled:opacity-30 transition-colors"
        style={{ background: "var(--color-primary)", color: "var(--font-primary)" }}>
        {t("widget.countdown_start")}
      </button>
    </div>
  );
}
