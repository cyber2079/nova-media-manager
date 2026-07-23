import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
// themeStore not needed — voice is now theme-agnostic

interface AlertConfig {
  active: boolean;
  glow: boolean;
  voice: boolean;
  voiceInterval: number;
}

function getVoiceInfo(isZh: boolean) {
  return {
    text: isZh ? "倒计时结束" : "Countdown finished",
    src: "",
  };
}

export default function CountdownAlert() {
  const { t, i18n } = useTranslation();
  const [cfg, setCfg] = useState<AlertConfig | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Play voice once on mount; repeat on configured interval if not dismissed
  useEffect(() => {
    if (!cfg) return;
    const isZh = i18n.language.startsWith("zh");
    const { src } = getVoiceInfo(isZh);

    const playNow = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.play().catch(() => {});
    };

    if (cfg.voice) {
      playNow();
      const intervalMs = Math.max(30, cfg.voiceInterval || 30) * 1000;
      repeatRef.current = setInterval(playNow, intervalMs);
    }

    return () => {
      if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null; }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [cfg, i18n.language]);

  const dismiss = useCallback(() => {
    if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null; }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCfg(null);
    hasAlertedRef.current = false;
    window.dispatchEvent(new CustomEvent("countdown-dismissed"));
  }, []);

  if (!cfg) return null;

  const isZh = i18n.language.startsWith("zh");
  const { text: message } = getVoiceInfo(isZh);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center select-none">
      {/* Glow layer */}
      {cfg.glow && (
        <div className="absolute inset-0 animate-pulse"
          style={{
            background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 25%, transparent) 0%, transparent 70%)",
            animationDuration: "1.5s",
          }} />
      )}

      {/* Popup card */}
      <div className="relative z-10 bg-surface-light/98 backdrop-blur-xl border border-primary/40 rounded-2xl shadow-2xl px-10 py-8 w-[620px] max-w-[90vw] mx-4 text-center space-y-6">
        <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: "var(--font-primary)" }}>
          {message}
        </p>
        <button
          onClick={dismiss}
          className="px-8 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          {isZh ? "我知道了" : "I Understand"}
        </button>
      </div>
    </div>,
    document.body
  );
}
