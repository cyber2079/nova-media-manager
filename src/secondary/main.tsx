/**
 * Secondary display — standalone WebView on external monitor.
 */
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "../index.css";

function App() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: "#080c14",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      color: "#fff", fontFamily: "system-ui",
    }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>Nova 副屏</h1>
      <p style={{ fontSize: "1rem", color: "#96adc8", marginBottom: "2rem" }}>
        播放音乐时此处将显示封面和频谱
      </p>
      <div style={{ fontSize: "3rem", fontFamily: "monospace", color: "#7aafff" }}>
        {time.toLocaleTimeString("zh-CN", { hour12: false })}
      </div>
      <p style={{ fontSize: "0.85rem", color: "#56555f", marginTop: "0.5rem" }}>
        {time.toLocaleDateString("zh-CN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}

const el = document.getElementById("secondary-root");
if (el) {
  ReactDOM.createRoot(el).render(<React.StrictMode><App /></React.StrictMode>);
}
