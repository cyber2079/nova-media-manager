/**
 * SecondaryDisplay — rendered when ?secondary=1 is in URL.
 * Zustand stores are isolated per WebView. State comes via Tauri IPC events.
 */

import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface NowPlayingPayload {
  title: string;
  artist?: string;
  album?: string;
  coverPath?: string;
  duration?: string;
  currentTime?: string;
  isPlaying: boolean;
}

export default function SecondaryDisplay() {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingPayload | null>(null);
  const [time, setTime] = useState(new Date());

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Listen for now-playing events from main window
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const window = getCurrentWebviewWindow();
        unlisten = await window.listen<NowPlayingPayload>("now-playing", (e) => {
          setNowPlaying(e.payload);
        });
      } catch (err) {
        console.warn("[secondary] IPC listen failed:", err);
      }
    })();
    return () => { unlisten?.(); };
  }, []);

  const isPlaying = nowPlaying?.isPlaying;

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: "linear-gradient(135deg, #080c14 0%, #0a1628 50%, #080c14 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      color: "#fff", fontFamily: "system-ui", gap: "1.5rem",
    }}>
      {/* Now Playing */}
      {isPlaying && nowPlaying && (
        <div style={{ textAlign: "center", maxWidth: "600px" }}>
          {nowPlaying.coverPath && (
            <div style={{ width: "min(45vh, 350px)", height: "min(45vh, 350px)", margin: "0 auto 1.5rem",
              borderRadius: "1.5rem", overflow: "hidden", boxShadow: "0 0 60px rgba(71,136,240,0.2)" }}>
              <img src={nowPlaying.coverPath} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>{nowPlaying.title}</h1>
          <p style={{ fontSize: "1rem", color: "#96adc8" }}>{nowPlaying.artist}{nowPlaying.album ? ` · ${nowPlaying.album}` : ""}</p>
          {nowPlaying.duration && nowPlaying.currentTime && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem",
              maxWidth: "400px", margin: "1rem auto 0", fontSize: "0.85rem", color: "#96adc8" }}>
              <span>{nowPlaying.currentTime}</span>
              <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--color-primary, #4788f0)",
                  width: `${(parseTime(nowPlaying.currentTime) / (parseTime(nowPlaying.duration) || 1)) * 100}%` }} />
              </div>
              <span>{nowPlaying.duration}</span>
            </div>
          )}
        </div>
      )}

      {/* Idle */}
      {!isPlaying && (
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Nova 副屏</h1>
          <p style={{ fontSize: "1rem", color: "#96adc8", marginTop: "0.5rem" }}>播放音乐时将展示封面与频谱</p>
        </div>
      )}

      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", fontFamily: "monospace", color: "#7aafff" }}>
          {time.toLocaleTimeString("zh-CN", { hour12: false })}
        </div>
      </div>
    </div>
  );
}

function parseTime(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}
