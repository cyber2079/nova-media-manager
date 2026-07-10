import { useEffect, useRef } from "react";

const CG_BASE = "/themes/cyber%20girl/pic";

// 16 scenes in order — intro → daily → squad → comm → battle → aftermath → crisis
const SCENES = [
  { bg: `${CG_BASE}/start1.webp`,            face: "no face.webp",             skillShow: false },
  { bg: `${CG_BASE}/start2-listen song.webp`, face: "happy face.webp",         skillShow: true },
  { bg: `${CG_BASE}/start3.webp`,             face: "no face.webp",            skillShow: false },
  { bg: `${CG_BASE}/bg1.webp`,                face: "communicate face.webp",   skillShow: false },
  { bg: `${CG_BASE}/bg2.webp`,                face: "angry face.webp",         skillShow: false },
  { bg: `${CG_BASE}/1.webp`,                  face: "say face.webp",           skillShow: false },
  { bg: `${CG_BASE}/2.webp`,                  face: "say face.webp",           skillShow: false },
  { bg: `${CG_BASE}/3.webp`,                  face: "say face.webp",           skillShow: false },
  { bg: `${CG_BASE}/4.webp`,                  face: "say face.webp",           skillShow: false },
  { bg: `${CG_BASE}/5.webp`,                  face: "say face.webp",           skillShow: false },
  { bg: `${CG_BASE}/6.webp`,                  face: "angry face.webp",         skillShow: false },
  { bg: `${CG_BASE}/7.webp`,                  face: "happy face.webp",         skillShow: false },
  { bg: `${CG_BASE}/start34.webp`,            face: "communicate face.webp",   skillShow: false },
  { bg: `${CG_BASE}/bg3.webp`,                face: "angry face.webp",         skillShow: false },
  { bg: `${CG_BASE}/start4.webp`,             face: "say face.webp",           skillShow: false },
  { bg: `${CG_BASE}/end.webp`,                face: "angry face.webp",         skillShow: false },
];

export interface CgScene { bg: string; face: string; skillShow: boolean; }
export const CG_SCENES: CgScene[] = SCENES;

// ═══════════════════ MODULE-LEVEL STATE ═══════════════════
// Using module-level state so nothing resets on React re-renders.

const _images = new Map<string, HTMLImageElement>();
let _sceneIdx = -1;
let _currentBg = "";
let _canvas: HTMLCanvasElement | null = null;
let _timerId: ReturnType<typeof setTimeout> | null = null;
let _rafId = 0;
let _mode = "fill";

// Particle transition state
const COLS = 10, ROWS = 7;
let _particles: { col: number; row: number; x: number; y: number; w: number; h: number; delay: number; progress: number }[] = [];
let _nextBg = "";
let _animStart = 0;
const ANIM_DUR = 1200;

// Pub/Sub for Home.tsx
let _cgSceneIdx = 0;
const _listeners = new Set<(idx: number) => void>();

export function getCgSceneIdx(): number { return _cgSceneIdx; }
export function onCgSceneChange(fn: (idx: number) => void): () => void {
  _listeners.add(fn);
  fn(_cgSceneIdx);
  return () => { _listeners.delete(fn); };
}
function notify(idx: number) {
  _cgSceneIdx = idx;
  _listeners.forEach((fn) => fn(idx));
}

// ═══════════════════ HELPERS ═══════════════════

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function computeFit(iw: number, ih: number, cw: number, ch: number, mode: string) {
  if (mode === "stretch") return { dx: 0, dy: 0, dw: cw, dh: ch };
  if (mode === "normal") {
    const scale = Math.min(cw / iw, ch / ih);
    return { dx: (cw - iw * scale) / 2, dy: (ch - ih * scale) / 2, dw: iw * scale, dh: ih * scale };
  }
  const scale = Math.max(cw / iw, ch / ih);
  return { dx: (cw - iw * scale) / 2, dy: (ch - ih * scale) / 2, dw: iw * scale, dh: ih * scale };
}

function buildParticles(w: number, h: number) {
  const cellW = w / COLS, cellH = h / ROWS;
  const ps: typeof _particles = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ps.push({
        col, row,
        x: col * cellW, y: row * cellH,
        w: cellW + 1, h: cellH + 1,
        delay: (row + (COLS - 1 - col)) / (ROWS - 1 + COLS - 1),
        progress: 0,
      });
    }
  }
  return ps;
}

// ═══════════════════ CORE ENGINE ═══════════════════

function drawFrame() {
  if (!_canvas) return;
  const ctx = _canvas.getContext("2d");
  if (!ctx) return;
  const w = _canvas.width, h = _canvas.height;
  const now = performance.now();
  const elapsed = now - _animStart;

  const nextImg = _images.get(_nextBg);
  const currentImg = _images.get(_currentBg);

  ctx.clearRect(0, 0, w, h);

  // Layer 1: NEW image (full, underneath)
  if (nextImg?.complete && nextImg.naturalWidth > 0) {
    const fit = computeFit(nextImg.naturalWidth, nextImg.naturalHeight, w, h, _mode);
    ctx.drawImage(nextImg, fit.dx, fit.dy, fit.dw, fit.dh);
  }

  // Layer 2: OLD image as animated particles
  if (currentImg?.complete && currentImg.naturalWidth > 0 && _particles.length > 0) {
    const iw = currentImg.naturalWidth, ih = currentImg.naturalHeight;
    const fit = computeFit(iw, ih, w, h, _mode);
    let allDone = true;

    for (const p of _particles) {
      const localElapsed = elapsed - p.delay * ANIM_DUR * 0.7;
      p.progress = localElapsed <= 0 ? 0 : easeInOutCubic(Math.min(1, localElapsed / (ANIM_DUR * 0.3)));
      if (p.progress >= 0.999) continue;
      allDone = false;

      const t = p.progress;
      const sx = ((p.x - fit.dx) / fit.dw) * iw, sy = ((p.y - fit.dy) / fit.dh) * ih;
      const sw = (p.w / fit.dw) * iw, sh = (p.h / fit.dh) * ih;
      if (sx + sw <= 0 || sy + sh <= 0 || sx >= iw || sy >= ih) continue;

      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      ctx.save();
      ctx.globalAlpha = 1 - t * t;
      ctx.translate(cx, cy + t * 8);
      ctx.scale(1 - t, 1);
      ctx.translate(-cx, -cy);
      ctx.drawImage(currentImg, sx, sy, sw, sh, p.x, p.y, p.w, p.h);
      ctx.restore();
    }

    if (allDone) {
      _particles = [];
      _currentBg = _nextBg;
    }
  }

  if (_particles.length > 0) {
    _rafId = requestAnimationFrame(drawFrame);
  }
}

function doSwitch() {
  if (!_canvas) return;

  // Resize canvas
  _canvas.width = window.innerWidth;
  _canvas.height = window.innerHeight;

  _sceneIdx = (_sceneIdx + 1) % SCENES.length;
  const scene = SCENES[_sceneIdx];

  _nextBg = scene.bg;
  _particles = buildParticles(_canvas.width, _canvas.height);
  _animStart = performance.now();

  notify(_sceneIdx);

  cancelAnimationFrame(_rafId);
  _rafId = requestAnimationFrame(drawFrame);
}

function scheduleNext() {
  if (_timerId) clearTimeout(_timerId);
  _timerId = setTimeout(() => { doSwitch(); scheduleNext(); }, 22000 + Math.random() * 8000);
}

// ═══════════════════ COMPONENT ═══════════════════

interface Props { mode: string; }

export default function CyberGirlBgSwitcher({ mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    _mode = mode;
    _canvas = canvasRef.current;
    if (!_canvas) return;

    // Preload images (idempotent)
    SCENES.forEach((s) => {
      if (!_images.has(s.bg)) {
        const img = new Image();
        img.src = s.bg;
        _images.set(s.bg, img);
      }
    });

    // ── Resize handler (always re-attach after strict-mode remount) ──
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

    // ── One-time init (idempotent: only runs if engine isn't already started) ──
    if (_sceneIdx < 0) {
      _sceneIdx = 0;
      _currentBg = SCENES[0].bg;
      notify(0);

      const img = _images.get(_currentBg);
      if (img?.complete && img.naturalWidth > 0) {
        resize();
      } else if (img) {
        img.onload = resize;
      }

      scheduleNext();
    } else if (_rafId === 0 && _timerId === null) {
      // Engine was stopped by a previous cleanup (strict-mode). Restart it.
      scheduleNext();
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
