import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DesktopWidget from "@/components/DesktopWidget";
import type { WidgetConfig } from "@/stores/widgetStore";

// Theme-aware colors — 3 distinct hues, same pattern as ClockWidget & SystemMonitorWidget
const primaryColor = "var(--color-primary)";
const lightColor = "var(--color-primary-light)";
const accentColor = "var(--color-accent)";

function Snowflake({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const s = size;
  return (
    <g transform={`translate(${cx},${cy})`}>
      {[0, 60, 120].map((deg) => (
        <line key={"a" + deg} x1={0} y1={0} x2={0} y2={-s}
          stroke={lightColor} strokeWidth="0.8" strokeLinecap="round" style={{ filter: "brightness(1.2)" }} />
      ))}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <g key={"b" + deg} transform={`rotate(${deg})`}>
          <line x1={0} y1={-s * 0.5} x2={s * 0.3} y2={-s * 0.7}
            stroke={lightColor} strokeWidth="0.6" strokeLinecap="round" style={{ filter: "brightness(1.2)" }} />
          <line x1={0} y1={-s * 0.5} x2={-s * 0.3} y2={-s * 0.7}
            stroke={lightColor} strokeWidth="0.6" strokeLinecap="round" style={{ filter: "brightness(1.2)" }} />
          <line x1={0} y1={-s * 0.75} x2={s * 0.2} y2={-s * 0.9}
            stroke={lightColor} strokeWidth="0.5" strokeLinecap="round" style={{ filter: "brightness(1.2)" }} />
          <line x1={0} y1={-s * 0.75} x2={-s * 0.2} y2={-s * 0.9}
            stroke={lightColor} strokeWidth="0.5" strokeLinecap="round" style={{ filter: "brightness(1.2)" }} />
        </g>
      ))}
      <circle cx="0" cy="0" r="2.5" fill={primaryColor} style={{ filter: `drop-shadow(0 0 5px ${primaryColor}) brightness(1.3)` }} />
    </g>
  );
}

export default function CalendarWidget({ config }: { config: WidgetConfig }) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayPct = (day - 1) / (daysInMonth - 1 || 1);

  const localeMap: Record<string,string>={zh:"zh-CN",en:"en-US",ja:"ja-JP",ko:"ko-KR",fr:"fr-FR",de:"de-DE",it:"it-IT"};
  const loc=localeMap[i18n.language]||"en-US";
  const monthStr=now.toLocaleDateString(loc,{month:"short"}).toUpperCase();
  const showYear=now.toLocaleDateString(loc,{year:"numeric"});
  const barTop=14; const barBot=126; const barLen=barBot-barTop;
  const cy = barBot - dayPct * barLen;

  return (
    <DesktopWidget position={config.position}>
      <div className="flex flex-col items-center gap-1">
        {/* Year · Month — accent color like clock date text */}
        <span className="text-[10px] font-medium tracking-[0.1em]" style={{ color: accentColor, filter: "brightness(1.2)" }}>
          {showYear} · {monthStr}
        </span>
        {/* Days in month count — light color */}
        <span className="text-[8px] tracking-wider mt-0.5" style={{ color: lightColor, filter: "brightness(1.2)" }}>
          {daysInMonth}{t("widget.days")}
        </span>

        <div className="relative">
          <svg width="80" height="130" viewBox="0 0 80 130" className="drop-shadow-lg">
            {/* Staff rod — subtle white, same as clock tick marks */}
            <line x1="40" y1={barTop} x2="40" y2={barBot} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Progress bar — primary color */}
            <line x1="40" y1={cy} x2="40" y2={barBot}
              stroke={primaryColor} strokeWidth="2" strokeLinecap="round" style={{ filter: "brightness(1.3)" }} />

            {/* Snowflake — uses lightColor internally */}
            <Snowflake cx={40} cy={cy} size={8} />

            {/* Top ornament — accent color */}
            <circle cx="40" cy={barTop - 4} r="2.5" fill={accentColor} style={{ filter: "brightness(1.2)" }} />
            {/* Bottom ornament — primary color */}
            <circle cx="40" cy={barBot + 4} r="2.5" fill={primaryColor} style={{ filter: "brightness(1.2)" }} />
          </svg>

          {/* Day number — primary color, same as SystemMonitorWidget center text */}
          <div className="absolute inset-0 flex flex-col items-start justify-center pointer-events-none"
            style={{ left: "62px", top: (cy - 8) + "px" }}>
            <span className="text-[11px] font-bold" style={{ color: primaryColor, filter: "brightness(1.3)" }}>
              {day}
            </span>
          </div>
        </div>

        {/* Bottom label — light color */}
        <span className="text-[9px] tracking-wider" style={{ color: lightColor, filter: "brightness(1.2)" }}>
          {t("widget.day_n", { n: day })}
        </span>
      </div>
    </DesktopWidget>
  );
}
