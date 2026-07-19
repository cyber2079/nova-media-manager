import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DesktopWidget from "@/components/DesktopWidget";
import type { WidgetConfig } from "@/stores/widgetStore";

// Theme-aware colors
const primaryColor = "var(--color-primary)";
const accentColor = "var(--color-accent)";

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
        <span className="text-[10px] font-medium tracking-[0.1em]" style={{ color: "var(--font-widget)", filter: "brightness(1.2)" }}>
          {showYear} · {monthStr}
        </span>
        {/* Days in month count — light color */}
        <span className="text-[8px] tracking-wider mt-0.5" style={{ color: "var(--font-widget)", filter: "brightness(1.2)", opacity: 0.7 }}>
          {daysInMonth}{t("widget.days")}
        </span>

        <div className="relative">
          <svg width="80" height="130" viewBox="0 0 80 130" className="drop-shadow-lg">
            {/* Staff rod — subtle white, same as clock tick marks */}
            <line x1="40" y1={barTop} x2="40" y2={barBot} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Progress bar — primary color */}
            <line x1="40" y1={cy} x2="40" y2={barBot}
              stroke={primaryColor} strokeWidth="2" strokeLinecap="round" style={{ filter: "brightness(1.3)" }} />

            {/* 当前日期圆点 */}
            <circle cx="40" cy={cy} r="4" fill={primaryColor} style={{ filter: `drop-shadow(0 0 4px ${primaryColor}) brightness(1.3)` }} />

            {/* Top ornament — accent color */}
            <circle cx="40" cy={barTop - 4} r="2.5" fill={accentColor} style={{ filter: "brightness(1.2)" }} />
            {/* Bottom ornament — primary color */}
            <circle cx="40" cy={barBot + 4} r="2.5" fill={primaryColor} style={{ filter: "brightness(1.2)" }} />
          </svg>

          {/* 当前日期 — 跟随圆点垂直居中 */}
          <div className="absolute flex items-center pointer-events-none"
            style={{ left: "60px", top: cy + "px", transform: "translateY(-50%)" }}>
            <span className="text-[11px] font-bold leading-none" style={{ color: "var(--font-widget)", filter: "brightness(1.3)" }}>
              {day}
            </span>
          </div>
        </div>

        {/* 月初标记 — 始终显示第1天 */}
        <span className="text-[9px] tracking-wider" style={{ color: "var(--font-widget)", filter: "brightness(1.2)", opacity: 0.7 }}>
          {t("widget.month_start")}
        </span>
      </div>
    </DesktopWidget>
  );
}
