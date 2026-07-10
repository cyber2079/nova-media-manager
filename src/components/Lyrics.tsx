import { useEffect, useMemo, useState } from "react";
import { readFileSafe } from "@/lib/readFileSafe";
import { useSettingsStore } from "@/stores/settingsStore";

type Line = { time: number; text: string };

function parseLrc(text: string): Line[] {
  const lines = text.split(/\r?\n/);
  const out: Line[] = [];
  const re = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  for (const l of lines) {
    let m: RegExpExecArray | null;
    let lastIndex = 0;
    while ((m = re.exec(l)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
      const time = min * 60 + sec + ms / 1000;
      lastIndex = re.lastIndex;
      const textPart = l.slice(lastIndex).trim();
      out.push({ time, text: textPart });
    }
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

function parseSrt(text: string): Line[] {
  const parts = text.split(/\r?\n{2,}/);
  const out: Line[] = [];
  const timeRe = /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s-->\s(\d{2}):(\d{2}):(\d{2}),(\d{3})/;
  for (const p of parts) {
    const lines = p.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const t = lines[1].match(timeRe);
    if (!t) continue;
    const h = parseInt(t[1], 10), m = parseInt(t[2], 10), s = parseInt(t[3], 10), ms = parseInt(t[4], 10);
    const time = h * 3600 + m * 60 + s + ms / 1000;
    const text = lines.slice(2).join(" ");
    out.push({ time, text });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

export default function Lyrics({ filePath, currentTime, previewOffset }: { filePath: string; currentTime: number; previewOffset?: number }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);

  const storePreview = useSettingsStore((s) => s.previewOffset);
  const usedPreview = previewOffset ?? storePreview ?? 1;
  const lyricFontSize = useSettingsStore((s) => s.lyricFontSize);
  const fontScale = lyricFontSize === "large" ? 1.75 : 1;

  useEffect(() => {
    if (!filePath) return;
    // try same-directory with .lrc/.ass/.srt
    const base = filePath.replace(/\.[^.]+$/, "");
    const candidates = [".lrc", ".ass", ".srt"];
    let cancelled = false;

    (async () => {
      for (const ext of candidates) {
        const p = base + ext;
        try {
          const data = await readFileSafe(p);
          // data is Uint8Array
          const text = new TextDecoder().decode(data);
          if (cancelled) return;
          let parsed: Line[] = [];
          if (ext === ".lrc") parsed = parseLrc(text);
          else if (ext === ".srt") parsed = parseSrt(text);
          else if (ext === ".ass") parsed = parseLrc(text); // fallback: pick time tags
          if (parsed.length > 0) {
            setLines(parsed);
            setLoadedPath(p);
            return;
          }
        } catch (e) {
          // ignore — file may not exist
        }
      }
      // no lyrics found
      setLines([]);
      setLoadedPath(null);
    })();

    return () => { cancelled = true; };
  }, [filePath]);

  const currentIndex = useMemo(() => {
    if (!lines || lines.length === 0) return -1;
    const eff = currentTime + usedPreview;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (eff >= lines[i].time) idx = i;
      else break;
    }
    return idx;
  }, [lines, currentTime, usedPreview]);
  // compute context texts even if lines empty (safe access)
  const prev = lines[currentIndex - 1]?.text ?? "";
  const next = lines[currentIndex + 1]?.text ?? "";

  // Per-character progress: evenly splits line duration across each character
  // Continuous line-fill: a single smooth value 0..N sweeping across the text.
  // Each char independently clamps its position against lineFill — no floor/activeIdx
  // jump, so the fill flows like liquid across character boundaries.
  // MUST be above the early-return so hooks stay in fixed order across renders
  const charProgress = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= lines.length) return { chars: [] as string[], lineFill: 0, N: 0 };
    const chars = [...(lines[currentIndex]?.text ?? "")];
    const N = chars.length;
    if (N === 0) return { chars: [], lineFill: 0, N: 0 };

    const lineStart = Math.max(0, lines[currentIndex].time - usedPreview);
    const nextLineTime = lines[currentIndex + 1]?.time;
    const lineEnd = nextLineTime
      ? Math.max(lineStart + 0.5, nextLineTime - usedPreview)
      : lineStart + 5;
    const D = Math.max(0.5, lineEnd - lineStart);
    const elapsed = Math.max(0, Math.min(D, currentTime - lineStart));
    const lineFill = (elapsed / D) * N; // 0 → N smoothly, no floor

    return { chars, lineFill, N };
  }, [lines, currentTime, usedPreview, currentIndex]);

  const visible = lyricFontSize !== "off";
  const hasLines = lines && lines.length > 0;

  return (
    <div style={{ width: "100%", maxWidth: 880, margin: "0 auto", marginBottom: 8, pointerEvents: "none", display: visible && hasLines ? "block" : "none" }}>
      <div style={{ pointerEvents: "auto", textAlign: "center", padding: "6px 12px", position: "relative" }}>
        <div style={{ fontSize: 13 * fontScale, color: "var(--lyric-other, var(--font-secondary))", opacity: 0.75, lineHeight: 1.1, minHeight: 18 * fontScale }}>{prev}</div>

        <div style={{ position: "relative", minHeight: 36 * fontScale, padding: "6px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ display: "inline-flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 0, fontSize: 17 * fontScale, fontWeight: 700, whiteSpace: "pre-wrap", wordBreak: "break-all", maxWidth: 760, lineHeight: `${36 * fontScale}px` }}>
            {charProgress.chars.map((ch, i) => {
              const charW = Math.max(0, Math.min(1, charProgress.lineFill - i)) * 100;

              return (
                <span key={i} style={{ position: "relative", display: "inline-block" }}>
                  <span style={{ color: "var(--lyric-current, var(--font-primary))", opacity: 0.65 }}>{ch}</span>
                  <span style={{ position: "absolute", left: 0, top: 0, overflow: "hidden", width: `${charW.toFixed(1)}%`, whiteSpace: "nowrap", pointerEvents: "none", transition: "width 90ms linear" }}>
                    <span style={{ color: "var(--lyric-fill, color-mix(in srgb, var(--color-primary) 45%, rgba(255,255,255,0.55)))" }}>{ch}</span>
                  </span>
                </span>
              );
            })}
          </span>
        </div>

        <div style={{ fontSize: 13 * fontScale, color: "var(--lyric-other, var(--font-secondary))", opacity: 0.75, lineHeight: 1.1, minHeight: 18 * fontScale }}>{next}</div>
      </div>
    </div>
  );
}
