import { ReactNode, useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useWidgetStore } from "@/stores/widgetStore";
import { Lock, Unlock } from "lucide-react";

const HEADER_H = 64;
const HANDLE_H = 22; // control bar extends this far above widget
const FOOTER_H = 48;

const PRESET_CLASSES: Record<string, string> = {
  "top-left":      "top-20 left-5",
  "top-right":     "top-20 right-5",
  "center-left":   "top-1/2 -translate-y-1/2 left-5",
  "center-right":  "top-1/2 -translate-y-1/2 right-5",
  "bottom-left":   "bottom-20 left-5",
  "bottom-right":  "bottom-20 right-5",
};

export default function DesktopWidget({ id, position, children, className }: {
  id: string;
  position: string;
  children: ReactNode;
  className?: string;
}) {
  const customPos = useWidgetStore((s) => s.widgetCustomPos[id]);
  const locked = useWidgetStore((s) => s.widgetLocked[id] !== false);
  const setWidgetPos = useWidgetStore((s) => s.setWidgetPos);
  const setWidgetLocked = useWidgetStore((s) => s.setWidgetLocked);

  const preset = PRESET_CLASSES[position] || "bottom-20 right-5";
  const isCustom = !!customPos;

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 40, h: 40 });

  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) setBox({ w: r.width, h: r.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const clamp = useCallback((x: number, y: number) => {
    const maxX = Math.max(0, window.innerWidth - box.w);
    const topMin = HEADER_H + HANDLE_H; // widget body must clear header + handle above it
    const maxY = Math.max(topMin, window.innerHeight - FOOTER_H - box.h);
    return {
      x: Math.max(0, Math.min(Math.round(x), maxX)),
      y: Math.max(topMin, Math.min(Math.round(y), maxY)),
    };
  }, [box]);

  const getCurrentPx = useCallback(() => {
    const el = widgetRef.current;
    if (!el) return { x: 100, y: 300 };
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }, []);

  const dragHandleDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startPx = getCurrentPx();
    dragStart.current = { sx: e.clientX, sy: e.clientY, ox: startPx.x, oy: startPx.y };

    const onMove = (ev: PointerEvent) => {
      if (!dragStart.current) return;
      // Don't track mouse into header — keeps cursor + widget below header
      if (ev.clientY <= HEADER_H + HANDLE_H) return;
      const nx = dragStart.current.ox + (ev.clientX - dragStart.current.sx);
      const ny = dragStart.current.oy + (ev.clientY - dragStart.current.sy);
      const c = clamp(nx, ny);
      widgetRef.current!.style.left = c.x + "px";
      widgetRef.current!.style.top = c.y + "px";
    };

    const onUp = (ev: PointerEvent) => {
      if (!dragStart.current) return;
      let nx = dragStart.current.ox + (ev.clientX - dragStart.current.sx);
      let ny = dragStart.current.oy + (ev.clientY - dragStart.current.sy);
      // If mouse ended up in header, use last valid position from clamp
      const el = widgetRef.current!;
      const curX = parseFloat(el.style.left) || nx;
      const curY = parseFloat(el.style.top) || ny;
      const final = ev.clientY <= HEADER_H + HANDLE_H
        ? clamp(curX, curY)
        : clamp(nx, ny);
      setWidgetPos(id, final.x, final.y);
      setDragOffset(null);
      dragStart.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [clamp, id, setWidgetPos, getCurrentPx]);

  const isDragging = dragOffset !== null;
  const needsPixel = isCustom && !isDragging;

  return (
    <div
      ref={widgetRef}
      className={cn(
        "fixed z-[47] select-none pointer-events-auto group/widget",
        needsPixel ? "" : preset,
        className
      )}
      style={needsPixel ? {
        left: customPos!.x,
        top: customPos!.y,
        transform: isDragging ? "scale(1.04)" : "none",
        transition: isDragging ? "none" : "left 0.1s ease-out, top 0.1s ease-out",
      } : undefined}
    >
      {/* Control bar overlay — sits ABOVE children, captures pointer events first */}
      {!locked && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-auto select-none" style={{ marginTop: -22, height: 20 }}>
          <div
            onPointerDown={dragHandleDown}
            className="w-6 h-5 flex items-center justify-center rounded bg-surface-dark/95 border border-primary/40 hover:bg-primary/20 cursor-grab active:cursor-grabbing transition-colors shadow-lg"
            title="拖拽移动 / Drag to move"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-light/80">
              <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
            </svg>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setWidgetLocked(id, true); }}
            className="w-5 h-5 ml-0.5 flex items-center justify-center rounded-full bg-surface-dark/95 border border-white/15 hover:border-primary/40 transition-colors shadow-lg"
            title="锁定 / Lock"
          >
            <Unlock className="h-2.5 w-2.5 text-primary-light" />
          </button>
        </div>
      )}
      {/* Locked: lock icon above, outside content area */}
      {locked && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 opacity-0 group-hover/widget:opacity-100 transition-opacity pointer-events-auto select-none z-10" style={{ marginTop: -20 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setWidgetLocked(id, false); }}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-surface-dark/95 border border-white/15 hover:border-primary/40 transition-colors shadow-lg"
            title="解锁拖拽 / Unlock drag"
          >
            <Lock className="h-2.5 w-2.5 text-gray-400" />
          </button>
        </div>
      )}
      {/* Widget content — lower z-index so controls capture events first */}
      <div className="pointer-events-auto" style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
