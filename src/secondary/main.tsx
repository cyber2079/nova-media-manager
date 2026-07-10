/**
 * Secondary display entry point.
 * Renders widget panels on the second monitor.
 * Launched via Tauri multi-window (open_secondary_window Rust command).
 */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "../index.css"; // reuse global styles + theme variables
import WidgetPanel from "./WidgetPanel";
import type { NowPlayingPayload } from "@/lib/crossWindow";

function SecondaryApp() {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingPayload | null>(null);
  const [clockVisible, setClockVisible] = useState(true);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");

  useEffect(() => {
    const window = getCurrentWebviewWindow();

    // Detect orientation
    const checkOrientation = () => {
      setOrientation(window.innerWidth > window.innerHeight ? "landscape" : "portrait");
    };
    checkOrientation();
    const resizeObs = new ResizeObserver(checkOrientation);
    resizeObs.observe(document.body);

    // Listen for events from main window
    let unlistenNowPlaying: (() => void) | undefined;
    let unlistenWidget: (() => void) | undefined;

    (async () => {
      try {
        unlistenNowPlaying = await window.listen<NowPlayingPayload>("now-playing", (e) => {
          setNowPlaying(e.payload);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unlistenWidget = await window.listen<{ widget: string; data: any }>("widget-state", (e) => {
          if (e.payload.widget === "clock") {
            setClockVisible(e.payload.data?.visible ?? true);
          }
        });
      } catch (err) {
        console.error("[secondary] Failed to listen for events:", err);
      }
    })();

    return () => {
      resizeObs.disconnect();
      unlistenNowPlaying?.();
      unlistenWidget?.();
    };
  }, []);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center select-none"
      style={{
        background: "color-mix(in srgb, var(--color-primary) 4%, rgba(8,2,20,0.96))",
      }}
      data-theme={document.documentElement.getAttribute("data-theme") || "cyber-girl"}
    >
      <WidgetPanel
        nowPlaying={nowPlaying}
        orientation={orientation}
        showClock={clockVisible}
      />
    </div>
  );
}

createRoot(document.getElementById("secondary-root")!).render(
  <StrictMode>
    <SecondaryApp />
  </StrictMode>,
);
