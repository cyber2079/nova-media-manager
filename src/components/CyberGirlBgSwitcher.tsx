import { useEffect, useRef } from "react";

const CG = import.meta.env.VITE_LICENSE_TIER === "pro" ? "/themes/cyber%20girl" : "https://nova.localhost/cyber-girl";

// 16 scenes — bg from scenes/, face from faces/
const SCENES = [
  { bg: `${CG}/bg.webp`,                         face: "neutral",    skillShow: false },
  { bg: `${CG}/scenes/skill-show-music.webp`,    face: "happy",      skillShow: true },
  { bg: `${CG}/scenes/scene-01.webp`,            face: "neutral",    skillShow: false },
  { bg: `${CG}/scenes/scene-11.webp`,            face: "talk",       skillShow: false },
  { bg: `${CG}/scenes/scene-12.webp`,            face: "angry",      skillShow: false },
  { bg: `${CG}/scenes/scene-04.webp`,            face: "talk",       skillShow: false },
  { bg: `${CG}/scenes/scene-05.webp`,            face: "talk",       skillShow: false },
  { bg: `${CG}/scenes/scene-06.webp`,            face: "talk",       skillShow: false },
  { bg: `${CG}/scenes/scene-07.webp`,            face: "talk",       skillShow: false },
  { bg: `${CG}/scenes/scene-08.webp`,            face: "talk",       skillShow: false },
  { bg: `${CG}/scenes/scene-09.webp`,            face: "angry",      skillShow: false },
  { bg: `${CG}/scenes/scene-10.webp`,            face: "happy",      skillShow: false },
  { bg: `${CG}/scenes/scene-02.webp`,            face: "talk",       skillShow: false },
  { bg: `${CG}/scenes/scene-13.webp`,            face: "angry",      skillShow: false },
  { bg: `${CG}/scenes/scene-03.webp`,            face: "talk",       skillShow: false },
  { bg: `${CG}/scenes/scene-14.webp`,            face: "angry",      skillShow: false },
];

export interface CgScene { bg: string; face: string; skillShow: boolean; }
export const CG_SCENES: CgScene[] = SCENES;

// ═══════════════════ MODULE-LEVEL STATE ═══════════════════

const _images = new Map<string, HTMLImageElement>();
let _sceneIdx = -1;
let _currentBg = "";
let _canvas: HTMLCanvasElement | null = null;
let _timerId: ReturnType<typeof setTimeout> | null = null;
let _rafId = 0;
let _mode = "fill";

// ── Hex dissolve transition state ──
const HEX_RADIUS = 36;
const HEX_H_SPACING = HEX_RADIUS * Math.sqrt(3);
const HEX_V_SPACING = HEX_RADIUS * 1.5;

interface HexCell {
  col: number; row: number;
  cx: number; cy: number;
  delay: number;   // 0..1, when the cell starts dissolving
  progress: number; // 0..1, 0=solid, 1=gone
}
let _hexes: HexCell[] = [];
let _nextBg = "";
let _animStart = 0;
const DISSOLVE_DUR = 2200;

// ── Holographic particle stream state ──
interface HoloParticle {
  x: number; y: number;
  speed: number; width: number; height: number;
  alpha: number; hue: number;
}
let _holoParticles: HoloParticle[] = [];
const HOLO_COUNT = 45;

// ── Breathing pulse ──
let _startTime = 0;

// ── Pub/Sub ──
let _cgSceneIdx = 0;
const _listeners = new Set<(idx: number) => void>();

export function getCgSceneIdx(): number { return _cgSceneIdx; }
export function onCgSceneChange(fn: (idx: number) => void): () => void {
  _listeners.add(fn); fn(_cgSceneIdx);
  return () => { _listeners.delete(fn); };
}
function notify(idx: number) { _cgSceneIdx = idx; _listeners.forEach(fn => fn(idx)); }

// ═══════════════ HELPERS ═══════════════

function easeOutExpo(t: number) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
function easeInOutCubic(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function computeFit(iw: number, ih: number, cw: number, ch: number, mode: string) {
  if (mode === "stretch") return { dx: 0, dy: 0, dw: cw, dh: ch };
  if (mode === "normal") {
    const scale = Math.min(cw / iw, ch / ih);
    return { dx: (cw - iw * scale) / 2, dy: (ch - ih * scale) / 2, dw: iw * scale, dh: ih * scale };
  }
  const scale = Math.max(cw / iw, ch / ih);
  return { dx: (cw - iw * scale) / 2, dy: (ch - ih * scale) / 2, dw: iw * scale, dh: ih * scale };
}

function rand(min: number, max: number) { return min + Math.random() * (max - min); }

/** Precompute hexagon vertices once. Flat-top orientation. */
function hexVertices(cx: number, cy: number, r: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return pts;
}

// ═══════════════ PARTICLE INIT ═══════════════

function initHoloParticles(w: number, h: number) {
  _holoParticles = [];
  for (let i = 0; i < HOLO_COUNT; i++) {
    _holoParticles.push({
      x: rand(0, w),
      y: rand(h * 0.2, h + 80),
      speed: rand(0.15, 1.8),
      width: rand(1.5, 4),
      height: rand(0.4, 1.6),
      alpha: rand(0.05, 0.22),
      hue: rand(195, 310),
    });
  }
}

// ═══════════════ HEX DISSOLVE ═══════════════

function buildHexGrid(w: number, h: number): HexCell[] {
  const cells: HexCell[] = [];
  let row = 0;
  for (let cy = HEX_RADIUS; cy < h + HEX_RADIUS; cy += HEX_V_SPACING) {
    const offset = (row % 2 === 0) ? 0 : HEX_H_SPACING / 2;
    for (let cx = offset - HEX_H_SPACING; cx < w + HEX_H_SPACING; cx += HEX_H_SPACING) {
      cells.push({
        col: Math.round(cx), row,
        cx, cy,
        delay: Math.random() * 0.55,
        progress: 0,
      });
    }
    row++;
  }
  return cells;
}

// ═══════════════ CORE ENGINE ═══════════════

function drawFrame() {
  if (!_canvas) return;
  const ctx = _canvas.getContext("2d");
  if (!ctx) return;
  const w = _canvas.width, h = _canvas.height;
  const now = performance.now();
  const elapsed = now - _animStart;
  const breathTime = (now - _startTime) / 1000;

  ctx.clearRect(0, 0, w, h);

  // ── LAYER 0: Deep black background + breathing pulse ──
  const pulseSize = 0.85 + 0.15 * Math.sin(breathTime * 0.25) * Math.sin(breathTime * 0.13 + 1.7);
  const pulseX = w / 2 + Math.sin(breathTime * 0.08) * w * 0.06;
  const pulseY = h * 0.45 + Math.cos(breathTime * 0.06) * h * 0.04;
  const pulseGrad = ctx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, Math.max(w, h) * pulseSize * 0.6);
  pulseGrad.addColorStop(0, "rgba(140,85,230,0.025)");
  pulseGrad.addColorStop(0.5, "rgba(140,15,210,0.008)");
  pulseGrad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = pulseGrad;
  ctx.fillRect(0, 0, w, h);

  // ── LAYER 1: Holographic particle stream ──
  for (const p of _holoParticles) {
    p.y -= p.speed;
    if (p.y < -20) {
      p.y = h + rand(30, 120);
      p.x = rand(0, w);
      p.speed = rand(0.15, 1.8);
      p.hue = rand(195, 310);
      p.alpha = rand(0.05, 0.22);
    }
    // Gentle horizontal drift
    p.x += Math.sin(p.y * 0.002 + p.hue) * 0.15;

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.width * 2.5);
    glow.addColorStop(0, `hsla(${p.hue}, 85%, 72%, ${p.alpha})`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - p.width * 1.5, p.y - p.height * 0.5, p.width * 3, p.height * 2);

    // Core line
    ctx.fillStyle = `hsla(${p.hue}, 90%, 85%, ${p.alpha * 1.4})`;
    ctx.fillRect(p.x - p.width * 0.5, p.y, p.width, p.height);
  }

  // ── LAYER 2: Scene background image ──
  const currentImg = _images.get(_currentBg);
  if (currentImg?.complete && currentImg.naturalWidth > 0) {
    const fit = computeFit(currentImg.naturalWidth, currentImg.naturalHeight, w, h, _mode);
    ctx.save();
    if (_hexes.length === 0) {
      // No transition — draw full image
      ctx.globalAlpha = 1;
      ctx.drawImage(currentImg, fit.dx, fit.dy, fit.dw, fit.dh);
    }
    ctx.restore();
  }

  // ── LAYER 3: Hex dissolve transition ──
  if (_hexes.length > 0) {
    const nextImg = _images.get(_nextBg);
    const prevImg = _images.get(_currentBg);
    let allDone = true;

    // Draw NEW image beneath
    if (nextImg?.complete && nextImg.naturalWidth > 0) {
      const nFit = computeFit(nextImg.naturalWidth, nextImg.naturalHeight, w, h, _mode);
      ctx.drawImage(nextImg, nFit.dx, nFit.dy, nFit.dw, nFit.dh);
    }

    // Draw OLD image through dissolving hex cells
    if (prevImg?.complete && prevImg.naturalWidth > 0) {
      const fit = computeFit(prevImg.naturalWidth, prevImg.naturalHeight, w, h, _mode);

      for (const cell of _hexes) {
        const localElapsed = elapsed - cell.delay * DISSOLVE_DUR * 0.65;
        cell.progress = localElapsed <= 0 ? 0
          : easeOutExpo(Math.min(1, localElapsed / (DISSOLVE_DUR * 0.35)));

        if (cell.progress < 0.999) {
          allDone = false;

          const t = cell.progress;
          const alpha = 1 - t * t;
          const liftY = t * 12; // subtle upward float

          const verts = hexVertices(cell.cx, cell.cy - liftY, HEX_RADIUS);

          ctx.save();
          ctx.globalAlpha = alpha;

          // Clip to hexagon
          ctx.beginPath();
          ctx.moveTo(verts[0].x, verts[0].y);
          for (let i = 1; i < 6; i++) ctx.lineTo(verts[i].x, verts[i].y);
          ctx.closePath();
          ctx.clip();

          // Draw the old image portion
          ctx.drawImage(prevImg, fit.dx, fit.dy, fit.dw, fit.dh);

          ctx.restore();
        }
      }
    }

    if (allDone) {
      _hexes = [];
      _currentBg = _nextBg;
    }
  }

  // ── Holographic scan line on new scene reveal ──
  const revealAge = elapsed - DISSOLVE_DUR;
  if (revealAge > 0 && revealAge < 500) {
    const scanAlpha = (1 - revealAge / 500) * 0.25;
    ctx.fillStyle = `rgba(180,130,255,${scanAlpha})`;
    ctx.fillRect(0, h * 0.65, w, 1);
    ctx.fillStyle = `rgba(180,130,255,${scanAlpha * 0.6})`;
    ctx.fillRect(0, h * 0.345, w, 0.5);
  }

  // ── Continue animation ──
  if (_hexes.length > 0 || _holoParticles.length > 0) {
    _rafId = requestAnimationFrame(drawFrame);
  }
}

function doSwitch() {
  if (!_canvas) return;
  _canvas.width = window.innerWidth;
  _canvas.height = window.innerHeight;

  _sceneIdx = (_sceneIdx + 1) % SCENES.length;
  const scene = SCENES[_sceneIdx];

  _nextBg = scene.bg;
  _hexes = buildHexGrid(_canvas.width, _canvas.height);
  _animStart = performance.now();

  notify(_sceneIdx);

  cancelAnimationFrame(_rafId);
  _rafId = requestAnimationFrame(drawFrame);
}

function scheduleNext() {
  if (_timerId) clearTimeout(_timerId);
  _timerId = setTimeout(() => { doSwitch(); scheduleNext(); }, 22000 + Math.random() * 8000);
}

// ═══════════════ COMPONENT ═══════════════

interface Props { mode: string; }

export default function CyberGirlBgSwitcher({ mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    _mode = mode;
    _canvas = canvasRef.current;
    if (!_canvas) return;

    // Preload images
    SCENES.forEach(s => {
      if (!_images.has(s.bg)) {
        const img = new Image();
        img.src = s.bg;
        _images.set(s.bg, img);
      }
    });

    // Init holographic particles
    if (_holoParticles.length === 0) {
      const w = _canvas?.width || window.innerWidth;
      const h = _canvas?.height || window.innerHeight;
      initHoloParticles(w, h);
    }

    const resize = () => {
      if (!_canvas) return;
      _canvas.width = window.innerWidth;
      _canvas.height = window.innerHeight;
      const curImg = _images.get(_currentBg);
      const ctx = _canvas.getContext("2d");
      if (!ctx || !curImg?.complete || curImg.naturalWidth === 0) return;
      const fit = computeFit(curImg.naturalWidth, curImg.naturalHeight, _canvas.width, _canvas.height, _mode);
      ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      ctx.drawImage(curImg, fit.dx, fit.dy, fit.dw, fit.dh);
    };
    window.addEventListener("resize", resize);
    resize();

    // One-time init
    if (_sceneIdx < 0) {
      _sceneIdx = 0;
      _currentBg = SCENES[0].bg;
      _startTime = performance.now();
      notify(0);

      const img = _images.get(_currentBg);
      if (img?.complete && img.naturalWidth > 0) resize();
      else if (img) img.onload = resize;

      scheduleNext();
    } else if (_rafId === 0 && _timerId === null) {
      // React strict-mode remount: restart engine
      scheduleNext();
      if (_holoParticles.length === 0) initHoloParticles(window.innerWidth, window.innerHeight);
      _rafId = requestAnimationFrame(drawFrame);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (_timerId) { clearTimeout(_timerId); _timerId = null; }
      cancelAnimationFrame(_rafId);
      _rafId = 0;
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="fixed inset-0 z-[1]" />;
}
