import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useThemeStore, type ThemeName } from "@/stores/themeStore";

interface AlertConfig {
  active: boolean;
  glow: boolean;
  voice: boolean;
  voiceInterval: number;
}

// ── Theme voice/text mapping ──
const themeVoice: Record<string, { prefix: string; zh: string; en: string }> = {
  "pretty-girl": {
    prefix: "loli",
    zh: "主人主人，看看时钟～时间已经到了哦。您有重要的事情要处理吧？再不去的话，我会担心得睡不着的。快去吧，我在这里等您回来～",
    en: "Master, the hand's passed this mark. You remember that important matter, don't you? I won't rush you, but time won't wait. Please go now, and I'll be here praying for you.",
  },
  "path-of-exile": {
    prefix: "ice",
    zh: "看到窗外的雪了吗？每一片都在提醒你——时间不等人。趁我还没把这条路冰封，去做你该做的事。",
    en: "See the snow outside the window? Each flake is reminding you — time waits for no one. Before I freeze this path over with ice, go do what you're meant to do.",
  },
  "black-white": {
    prefix: "lady",
    zh: "你的时间，我已经接管了。\n看够了吗？现在，立刻，去完成你该做的事。\n专注一点，别让我等太久。",
    en: "I've taken over your time now.\nHad your look? Now, right now, go do what you need to do.\nStay focused… don't keep me waiting too long.",
  },
  "cyber-girl": {
    prefix: "ling",
    zh: "倒计时归零，数据流已同步，该行动了，不遵守时间规则的代价可不小",
    en: "Time's up. Shadow, mark the next target.\nCountdown zero. Data stream synced — move out.\nTimer complete. Neural link confirms — advancing to next phase.",
  },
};

function getVoiceInfo(theme: ThemeName, isZh: boolean) {
  const v = themeVoice[theme] ?? themeVoice["path-of-exile"]!;
  const lang = isZh ? "zh" : "en";
  const text = isZh ? v.zh : v.en;
  const src = `/sound/${v.prefix}-${isZh ? "cn" : "en"}.mp3`;
  return { text, src };
}

export default function CountdownAlert() {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
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
    const { src } = getVoiceInfo(theme, isZh);

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
  }, [cfg, theme, i18n.language]);

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
  const { text: message } = getVoiceInfo(theme, isZh);

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
