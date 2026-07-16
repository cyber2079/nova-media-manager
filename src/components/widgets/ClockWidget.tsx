import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DesktopWidget from "@/components/DesktopWidget";
import type { WidgetConfig } from "@/stores/widgetStore";

function Ring({ cx, cy, r, pct, stroke, width }: { cx: number; cy: number; r: number; pct: number; stroke: string; width: number }) {
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="butt"
      strokeDasharray={`${circ} ${circ}`}
      strokeDashoffset={offset}
      transform={`rotate(-90 ${cx} ${cy})`}
      style={{ filter: "brightness(1.2)" }}
    />
  );
}

// Theme-aware colors — three distinct hues from CSS variables
const hourColor = "var(--color-primary)";
const minColor = "var(--color-primary-light)";
const secColor = "var(--color-accent)";

export default function ClockWidget({ config }: { config: WidgetConfig }) {
  const { i18n } = useTranslation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = time.getHours();
  const h12 = h % 12 || 12;
  const m = time.getMinutes();
  const s = time.getSeconds();
  const hourPct = (h12 + m / 60) / 12;
  const minPct = (m + s / 60) / 60;
  const secPct = s / 60;
  const localeMap: Record<string,string>={zh:"zh-CN",en:"en-US",ja:"ja-JP",ko:"ko-KR",fr:"fr-FR",de:"de-DE",it:"it-IT"};
  const loc=localeMap[i18n.language]||"en-US";

  return (
    <DesktopWidget position={config.position}>
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <svg width="100" height="100" viewBox="0 0 100 100" className="drop-shadow-lg">
            {/* Tick marks */}
            {Array.from({ length: 60 }).map((_, i) => {
              const angle = (i * 6 - 90) * (Math.PI / 180);
              const x2 = 50 + (i % 5 === 0 ? 41 : 43) * Math.cos(angle);
              const y2 = 50 + (i % 5 === 0 ? 41 : 43) * Math.sin(angle);
              const x1 = 50 + 37 * Math.cos(angle);
              const y1 = 50 + 37 * Math.sin(angle);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={i % 5 === 0 ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)"} strokeWidth={i % 5 === 0 ? 1.5 : 0.5} />;
            })}
            {/* Progress rings — three theme colors */}
            <Ring cx={50} cy={50} r={34} pct={hourPct} stroke={hourColor} width={3.5} />
            <Ring cx={50} cy={50} r={27} pct={minPct} stroke={minColor} width={2.5} />
            <Ring cx={50} cy={50} r={20} pct={secPct} stroke={secColor} width={1.8} />
            {/* Center time */}
            <text x="49" y="47" textAnchor="middle" fill="var(--font-widget)" fontSize="11" fontWeight="700" fontFamily="system-ui, monospace">
              {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
            </text>
            {/* Seconds + AM/PM */}
            <text x="49" y="60" textAnchor="middle" fill="var(--font-widget)" fontSize="8" fontFamily="system-ui" opacity="0.7">
              :{String(s).padStart(2, "0")} {h >= 12 ? "PM" : "AM"}
            </text>
            {/* Outer ring border */}
            <circle cx="50" cy="50" r={44} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          </svg>
        </div>
        <span className="text-[9px] tracking-wider uppercase" style={{ color: "var(--font-widget)", opacity: 0.6 }}>
          {time.toLocaleDateString(loc, { month: "short", day: "numeric" })}
        </span>
      </div>
    </DesktopWidget>
  );
}
