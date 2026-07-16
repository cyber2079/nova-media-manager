import { useEffect, useState, useCallback } from "react";
import DesktopWidget from "@/components/DesktopWidget";
import type { WidgetConfig } from "@/stores/widgetStore";

interface SystemInfo {
  cpu: number;
  memory: number;
  memory_used: number;
  memory_total: number;
  disk: number;
  disk_used: number;
  disk_total: number;
  net_down: number;
  net_up: number;
}

function formatSpeed(kbps: number): string {
  if (kbps >= 1024) return (kbps / 1024).toFixed(1) + " MB/s";
  if (kbps >= 1) return kbps.toFixed(0) + " KB/s";
  return kbps.toFixed(1) + " KB/s";
}

function Ring({ cx, cy, r, pct, stroke, width }: { cx: number; cy: number; r: number; pct: number; stroke: string; width: number }) {
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round"
      strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`}
      style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease", filter: "brightness(1.2)" }} />
  );
}

// Theme-aware color helpers — inline so CSS vars work in SVG
const cpuColor = "var(--color-primary)";
const memColor = "var(--color-primary-light)";
const netColor = "var(--color-accent)";

export default function SystemMonitorWidget({ config }: { config: WidgetConfig }) {
  const [info, setInfo] = useState<SystemInfo>({ cpu: 0, memory: 0, memory_used: 0, memory_total: 0, disk: 0, disk_used: 0, disk_total: 0, net_down: 0, net_up: 0 });
  const [tooltip, setTooltip] = useState("");

  const fetchInfo = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data = await invoke<SystemInfo>("get_system_info");
      setInfo(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchInfo();
    const t = setInterval(fetchInfo, 3000);
    return () => clearInterval(t);
  }, [fetchInfo]);

  const netPct = Math.min(((info.net_down + info.net_up) / 10240) * 100, 100);

  return (
    <DesktopWidget position={config.position}>
      <div
        className="flex flex-col items-center gap-1"
        onMouseEnter={() => setTooltip(`CPU ${info.cpu.toFixed(1)}%\n内存 ${info.memory.toFixed(1)}%\n↓ ${formatSpeed(info.net_down)} ↑ ${formatSpeed(info.net_up)}`)}
        onMouseLeave={() => setTooltip("")}
      >
        <div className="relative">
          <svg width="100" height="100" viewBox="0 0 100 100" className="drop-shadow-lg">
            {/* Background rings — theme colors at low opacity */}
            <circle cx="50" cy="50" r={38} fill="none" stroke={cpuColor} strokeOpacity="0.1" strokeWidth="6" />
            <circle cx="50" cy="50" r={29} fill="none" stroke={memColor} strokeOpacity="0.1" strokeWidth="5" />
            <circle cx="50" cy="50" r={20} fill="none" stroke={netColor} strokeOpacity="0.08" strokeWidth="4" />

            {/* Active rings */}
            <Ring cx={50} cy={50} r={38} pct={info.cpu} stroke={cpuColor} width={6} />
            <Ring cx={50} cy={50} r={29} pct={info.memory} stroke={memColor} width={5} />
            <Ring cx={50} cy={50} r={20} pct={netPct} stroke={netColor} width={4} />

            {/* Center text */}
            <text x="50" y="46" textAnchor="middle" fill={cpuColor} fontSize="12" fontWeight="700" fontFamily="system-ui" style={{ filter: "brightness(1.3)" }}>
              {info.cpu.toFixed(0)}%
            </text>
            <text x="50" y="58" textAnchor="middle" fill={memColor} fontSize="7" fontFamily="system-ui" fontWeight="500" style={{ filter: "brightness(1.2)" }}>
              MEM {info.memory.toFixed(0)}%
            </text>

            {/* Outer ring border */}
            <circle cx="50" cy="50" r={44} fill="none" stroke={cpuColor} strokeOpacity="0.2" strokeWidth="1" />
          </svg>

          <div className={`absolute -top-16 left-1/2 -translate-x-1/2 bg-[#1a1a2e] border border-primary rounded-lg px-3 py-1.5 shadow-xl whitespace-pre text-[10px] text-white pointer-events-none ${tooltip ? "visible opacity-100" : "invisible opacity-0"} transition-[opacity,visibility] duration-150`}>
            {tooltip || " "}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-2 text-[9px] tracking-wider uppercase items-center">
          <span style={{ color: "var(--font-widget)", filter: "brightness(1.3)" }}>CPU</span>
          <span className="text-[#8aa8c4]">·</span>
          <span style={{ color: "var(--font-widget)", filter: "brightness(1.2)" }}>MEM</span>
          <span className="text-[#8aa8c4]">·</span>
          <span style={{ color: "var(--font-widget)", filter: "brightness(1.2)" }}>{formatSpeed(info.net_down + info.net_up)}</span>
        </div>
      </div>
    </DesktopWidget>
  );
}
