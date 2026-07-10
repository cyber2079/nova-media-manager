import { useEffect, useRef, useState } from "react";

// Fallback-safe visualizer: uses Web Audio if possible, otherwise shows
// animated bars. Never throws — every operation is wrapped in try/catch.
export default function AudioVisualizer({ audioEl, isPlaying }: { audioEl: HTMLAudioElement | null; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const connectedRef = useRef(false);
  const [fallback, setFallback] = useState(false);

  // Try to connect analyser to audio element — do it ONCE
  useEffect(() => {
    if (!audioEl || connectedRef.current) return;
    connectedRef.current = true;

    try {
      const ac = new AudioContext();
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const src = ac.createMediaElementSource(audioEl);
      src.connect(analyser);
      analyser.connect(ac.destination);

      acRef.current = ac;
      analyserRef.current = analyser;
    } catch {
      setFallback(true);
    }

    return () => {
      // Cleanup on unmount
      try { acRef.current?.close(); } catch {}
    };
  }, [audioEl]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    let raf = 0;

    const draw = () => {
      try {
        ctx.clearRect(0, 0, w, h);
        const analyser = analyserRef.current;

        if (!analyser || !isPlaying || fallback) {
          // Animated idle bars — 32 thin bars, breath to the beat
          const t = Date.now() / 800;
          const bars = 32;
          const barW = (w / bars) - 1; // ~4px each
          for (let i = 0; i < bars; i++) {
            const phase = Math.sin(t + i * 0.4);
            const barH = 3 + phase * 7; // gentle 3-10px range
            const x = i * (barW + 1);
            ctx.fillStyle = "var(--color-primary)";
            ctx.globalAlpha = 0.08 + Math.abs(phase) * 0.06;
            ctx.fillRect(x, (h - barH) / 2, barW, Math.max(2, barH));
          }
          ctx.globalAlpha = 1;
          raf = requestAnimationFrame(draw);
          return;
        }

        const bars = 32;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / bars);
        const barW = (w / bars) - 1;

        for (let i = 0; i < bars; i++) {
          const v = data[i * step] / 255;
          const barH = Math.max(2, v * h * 0.9);
          const x = i * (barW + 1);
          ctx.fillStyle = "var(--color-primary)";
          ctx.globalAlpha = 0.15 + v * 0.7;
          ctx.fillRect(x, (h - barH) / 2, barW, barH);
        }
        ctx.globalAlpha = 1;
      } catch {}

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, fallback]);

  return <canvas ref={canvasRef} width={161} height={36} className="rounded-md opacity-80" style={{ background: "transparent" }} />;
}
