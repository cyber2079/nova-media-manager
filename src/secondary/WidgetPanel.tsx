/**
 * Secondary display widget panel.
 *
 * Renders widgets configurable by the user:
 * - Now-playing info (synced from main window)
 * - Clock
 * - System monitor placeholder
 * - Custom layout adapts to landscape/portrait orientation
 */
import { useEffect, useState } from "react";
import type { NowPlayingPayload } from "@/lib/crossWindow";
import { Music, Clock, Monitor } from "lucide-react";

interface Props {
  nowPlaying: NowPlayingPayload | null;
  orientation: "landscape" | "portrait";
  showClock: boolean;
}

export default function WidgetPanel({ nowPlaying, orientation, showClock }: Props) {
  const [time, setTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isLandscape = orientation === "landscape";
  const containerStyle = isLandscape
    ? "flex-row gap-6 items-center"
    : "flex-col gap-6 items-center";

  return (
    <div className={`flex ${containerStyle} p-8`}>
      {/* ── Now Playing Card ── */}
      {nowPlaying && (
        <div
          className="rounded-2xl p-6 border backdrop-blur-md space-y-4"
          style={{
            background: "color-mix(in srgb, var(--color-primary) 8%, rgba(10,5,20,0.9))",
            borderColor: "color-mix(in srgb, var(--color-primary) 25%, transparent)",
            maxWidth: isLandscape ? "380px" : "100%",
            width: "100%",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <Music className="h-5 w-5 text-primary-light" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white truncate max-w-[260px]">
                {nowPlaying.title}
              </h3>
              {nowPlaying.artist && (
                <p className="text-xs text-gray-400">{nowPlaying.artist}</p>
              )}
            </div>
          </div>

          {nowPlaying.album && (
            <p className="text-xs text-gray-500">{nowPlaying.album}</p>
          )}

          {/* Cover image */}
          {nowPlaying.coverPath && (
            <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <img
                src={nowPlaying.coverPath}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Time */}
          {nowPlaying.duration && nowPlaying.currentTime && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{nowPlaying.currentTime}</span>
              <div className="flex-1 mx-3 h-1 bg-surface-lighter rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: nowPlaying.duration && nowPlaying.currentTime
                      ? `${(parseTime(nowPlaying.currentTime) / parseTime(nowPlaying.duration)) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              <span>{nowPlaying.duration}</span>
            </div>
          )}

          {nowPlaying.isPlaying && (
            <div className="flex items-center justify-center gap-1.5 py-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-0.5 bg-primary-light rounded-full animate-pulse"
                  style={{
                    height: `${10 + Math.random() * 14}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state when nothing is playing ── */}
      {!nowPlaying && (
        <div
          className="rounded-2xl p-8 border backdrop-blur-md text-center space-y-4"
          style={{
            background: "color-mix(in srgb, var(--color-primary) 6%, rgba(10,5,20,0.9))",
            borderColor: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
            maxWidth: "380px",
            width: "100%",
          }}
        >
          <Monitor className="h-8 w-8 text-gray-600 mx-auto" />
          <div>
            <p className="text-sm text-gray-400">副屏面板</p>
            <p className="text-xs text-gray-600 mt-1">
              {isLandscape ? "播放音乐时，此处将显示当前曲目信息" : "请旋转至横屏获得最佳体验"}
            </p>
          </div>
        </div>
      )}

      {/* ── Clock Widget ── */}
      {showClock && (
        <div
          className="rounded-2xl p-6 border backdrop-blur-md text-center space-y-2"
          style={{
            background: "color-mix(in srgb, var(--color-primary) 6%, rgba(10,5,20,0.9))",
            borderColor: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
            maxWidth: isLandscape ? "260px" : "100%",
            width: "100%",
          }}
        >
          <Clock className="h-5 w-5 text-gray-500 mx-auto" />
          <div className="text-4xl font-mono font-bold text-white tracking-wider tabular-nums">
            {time.toLocaleTimeString("zh-CN", { hour12: false })}
          </div>
          <p className="text-xs text-gray-500">
            {time.toLocaleDateString("zh-CN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      )}
    </div>
  );
}

/** Parse "mm:ss" or "hh:mm:ss" to seconds */
function parseTime(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}
