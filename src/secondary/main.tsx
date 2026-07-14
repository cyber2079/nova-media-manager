/**
 * Secondary display entry — standalone WebView on external monitor.
 * Reads theme + music state from shared Zustand stores.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import "../index.css";
import WidgetPanel from "./WidgetPanel";

function App() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center"
      style={{ background: "color-mix(in srgb, var(--color-primary) 4%, #080c14)" }}>
      <WidgetPanel nowPlaying={null} orientation="landscape" showClock />
    </div>
  );
}

// Mount immediately
const el = document.getElementById("secondary-root");
if (el) {
  ReactDOM.createRoot(el).render(
    <React.StrictMode><App /></React.StrictMode>
  );
}
