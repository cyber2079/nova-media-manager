/**
 * CyberPcbBackground — Ultra-subtle PCB trace layer BEHIND main images
 *
 * No IC blocks, no components. Just faint copper bus lines + vias + slow energy dots.
 * CSS blur for depth. Extremely transparent — the character art is the star.
 */
import { useEffect, useRef } from "react";

interface Bus {
  x1: number; y1: number; x2: number; y2: number;
  count: number; // parallel lines in this bus
}

interface Via {
  x: number; y: number; r: number;
}

interface Dot {
  busIdx: number; t: number; speed: number; forward: boolean;
}

let _buses: Bus[] = [];
let _vias: Via[] = [];
let _dots: Dot[] = [];
let _w = 0, _h = 0;

function r(a: number, b: number) { return a + Math.random() * (b - a); }

export default function CyberPcbBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = _w = window.innerWidth;
      canvas.height = _h = window.innerHeight;
      buildLayout();
    };
    resize();
    window.addEventListener("resize", resize);

    function buildLayout() {
      const w = _w, h = _h;

      // ── BUS BUNDLES ──
      const buses: Bus[] = [];

      // Central vertical spine
      buses.push({ x1: w * 0.5, y1: h * 0.03, x2: w * 0.5, y2: h * 0.97, count: 16 });

      // Left memory bus
      buses.push({ x1: w * 0.08, y1: h * 0.1, x2: w * 0.44, y2: h * 0.25, count: 14 });
      buses.push({ x1: w * 0.12, y1: h * 0.25, x2: w * 0.44, y2: h * 0.25, count: 14 });

      // Right memory bus
      buses.push({ x1: w * 0.56, y1: h * 0.1, x2: w * 0.92, y2: h * 0.25, count: 14 });
      buses.push({ x1: w * 0.56, y1: h * 0.25, x2: w * 0.88, y2: h * 0.25, count: 14 });

      // Bottom I/O buses
      buses.push({ x1: w * 0.44, y1: h * 0.55, x2: w * 0.15, y2: h * 0.75, count: 10 });
      buses.push({ x1: w * 0.56, y1: h * 0.55, x2: w * 0.85, y2: h * 0.75, count: 10 });

      // Horizontal spread at bottom
      buses.push({ x1: w * 0.12, y1: h * 0.88, x2: w * 0.88, y2: h * 0.88, count: 6 });

      _buses = buses;

      // ── VIAS — along bus endpoints and midpoints ──
      const vias: Via[] = [];
      for (const b of buses) {
        // Vias at both ends
        for (let i = 0; i < 3; i++) {
          const offX = (Math.random() - 0.5) * b.count * 3;
          const offY = (Math.random() - 0.5) * b.count * 3;
          vias.push({ x: b.x1 + offX, y: b.y1 + offY, r: r(1, 2.2) });
          vias.push({ x: b.x2 + offX, y: b.y2 + offY, r: r(1, 2.2) });
        }
        // Midpoint vias
        const mx = (b.x1 + b.x2) / 2, my = (b.y1 + b.y2) / 2;
        for (let i = 0; i < 4; i++) {
          vias.push({ x: mx + (Math.random() - 0.5) * b.count * 3, y: my + (Math.random() - 0.5) * b.count * 3, r: r(1, 2.2) });
        }
      }
      _vias = vias;

      // ── ENERGY DOTS — very few ──
      const dots: Dot[] = [];
      for (let bi = 0; bi < buses.length; bi++) {
        if (buses[bi].count < 8) continue;
        dots.push({ busIdx: bi, t: r(0, 1), speed: r(0.00015, 0.0004), forward: true });
        dots.push({ busIdx: bi, t: r(0, 1), speed: r(0.00015, 0.0004), forward: false });
      }
      _dots = dots;
    }

    // ── ANIMATION LOOP ──
    function draw() {
      const w = _w, h = _h;
      ctx!.clearRect(0, 0, w, h);

      // Substrate
      ctx!.fillStyle = "rgba(6,4,14,0.12)";
      ctx!.fillRect(0, 0, w, h);

      // Buses
      for (const b of _buses) {
        const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const ux = dy / len, uy = -dx / len;
        const spacing = 2.5;
        const half = (b.count - 1) * spacing / 2;

        // Faint copper fill for the whole bus area
        ctx!.fillStyle = "rgba(140,120,100,0.06)";
        ctx!.beginPath();
        ctx!.moveTo(b.x1 + ux * (-half - 1.5), b.y1 + uy * (-half - 1.5));
        ctx!.lineTo(b.x2 + ux * (-half - 1.5), b.y2 + uy * (-half - 1.5));
        ctx!.lineTo(b.x2 + ux * (half + 1.5), b.y2 + uy * (half + 1.5));
        ctx!.lineTo(b.x1 + ux * (half + 1.5), b.y1 + uy * (half + 1.5));
        ctx!.closePath();
        ctx!.fill();

        // Individual trace lines
        for (let i = 0; i < b.count; i++) {
          const off = (i - (b.count - 1) / 2) * spacing;
          ctx!.strokeStyle = "rgba(145,130,110,0.25)";
          ctx!.lineWidth = 0.4;
          ctx!.beginPath();
          ctx!.moveTo(b.x1 + ux * off, b.y1 + uy * off);
          ctx!.lineTo(b.x2 + ux * off, b.y2 + uy * off);
          ctx!.stroke();
        }
      }

      // Vias
      for (const v of _vias) {
        ctx!.beginPath();
        ctx!.arc(v.x, v.y, v.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(130,120,105,0.2)";
        ctx!.fill();
      }

      // Energy dots
      for (const d of _dots) {
        const b = _buses[d.busIdx];
        if (!b) continue;
        d.t += d.speed;
        if (d.t > 1) d.t -= 1;
        const t = d.forward ? d.t : 1 - d.t;
        const px = b.x1 + (b.x2 - b.x1) * t;
        const py = b.y1 + (b.y2 - b.y1) * t;

        const g = ctx!.createRadialGradient(px, py, 0, px, py, 6);
        g.addColorStop(0, "rgba(160,200,220,0.22)");
        g.addColorStop(0.5, "rgba(160,200,220,0.06)");
        g.addColorStop(1, "transparent");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(px, py, 6, 0, Math.PI * 2);
        ctx!.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-[0] pointer-events-none"
    style={{ filter: "blur(1px) saturate(0.3) brightness(0.8)" }} />;
}
