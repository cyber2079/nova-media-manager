import { useEffect, useRef } from "react";

// ── Types ──

interface RainDrop {
  x: number; y: number; speed: number; length: number;
  alpha: number; hue: number; trail: number; angle: number;
}

interface DataParticle {
  x: number; y: number; vx: number; vy: number;
  size: number; alpha: number; hue: number; life: number; maxLife: number;
}

interface CircuitSegment {
  x1: number; y1: number; x2: number; y2: number;
  alpha: number; epoch: number;
}

interface CircuitDot {
  routeIdx: number;
  t: number; speed: number;
  size: number; hue: number; alpha: number;
}

interface LightBeam {
  x: number; baseWidth: number; height: number;
  swayPhase: number; swayAmp: number; swaySpeed: number;
  alpha: number; hue: number;
  targetX: number; targetWidth: number; targetHeight: number; // morph target
  morphStart: number; morphDur: number; // morph timing
}

// ── Dynamic config (randomised each epoch) ──

interface EpochConfig {
  routeCount: number;
  gridVerticals: number;
  gridHorizons: number;
  vanishX: number;
  vanishY: number;
  gridAlpha: number;
  beamCount: number;
  dotCount: number;
  rainCount: number;
  dataCount: number;
}

function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const HUE_PALETTES = [
  [280, 300, 320, 195, 210, 340],  // purple-magenta-cyan
  [290, 310, 200, 220, 260, 330],   // variant
  [270, 295, 315, 185, 205, 350],   // cooler
  [300, 325, 210, 235, 270, 345],   // warmer
  [260, 285, 305, 195, 220, 335],   // blue-shifted
  [310, 330, 200, 215, 280, 340],   // pink-shifted
];
let _palette = pick(HUE_PALETTES);

function epochConfig(cw: number, ch: number): EpochConfig {
  return {
    routeCount: Math.floor(rand(3, 8)),
    gridVerticals: Math.floor(rand(10, 22)),
    gridHorizons: Math.floor(rand(3, 8)),
    vanishX: cw * rand(0.35, 0.65),
    vanishY: ch * rand(0.08, 0.22),
    gridAlpha: rand(0.03, 0.08),
    beamCount: Math.floor(rand(4, 10)),
    dotCount: Math.floor(rand(12, 30)),
    rainCount: Math.floor(rand(40, 100)),
    dataCount: Math.floor(rand(30, 60)),
  };
}

// ── Component ──

export default function CyberParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rainRef = useRef<RainDrop[]>([]);
  const dataRef = useRef<DataParticle[]>([]);
  const allRoutesRef = useRef<CircuitSegment[][]>([]); // current epoch routes
  const prevRoutesRef = useRef<CircuitSegment[][]>([]); // fading-out routes
  const dotsRef = useRef<CircuitDot[]>([]);
  const beamsRef = useRef<LightBeam[]>([]);
  const timeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const epochRef = useRef(0);
  const epochTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const epochAlphaRef = useRef(1); // crossfade: 1 = new epoch, 0 = old epoch gone
  const nextChangeRef = useRef(0); // when to start next epoch transition
  const configRef = useRef<EpochConfig>(null!);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const w = canvas.width, h = canvas.height;

    // Random palette on startup
    _palette = pick(HUE_PALETTES);
    configRef.current = epochConfig(w, h);

    initRain(rainRef, configRef.current, w, h);
    initData(dataRef, configRef.current, w, h);
    initBeams(beamsRef, configRef.current, w, h, h);
    allRoutesRef.current = buildCircuitRoutes(configRef.current, w, h);
    prevRoutesRef.current = [];
    initDots(dotsRef, allRoutesRef.current);

    // Epoch transition — inside effect so it captures refs
    const startEpochTransition = (cw: number, ch: number) => {
      prevRoutesRef.current = allRoutesRef.current;
      epochRef.current++;
      _palette = pick(HUE_PALETTES);
      const cfg = epochConfig(cw, ch);
      configRef.current = cfg;
      allRoutesRef.current = buildCircuitRoutes(cfg, cw, ch);
      initDots(dotsRef, allRoutesRef.current);
      for (const b of beamsRef.current) {
        b.targetX = rand(cw * 0.03, cw * 0.97);
        b.targetWidth = rand(1.5, 7);
        b.targetHeight = rand(ch * 0.25, ch * 0.85);
        b.morphStart = performance.now();
        b.morphDur = rand(2000, 4000);
      }
      while (beamsRef.current.length < cfg.beamCount) beamsRef.current.push(spawnBeam(cw, ch));
      while (beamsRef.current.length > cfg.beamCount) beamsRef.current.pop();
      initRain(rainRef, cfg, cw, ch);
      initData(dataRef, cfg, cw, ch);
      epochAlphaRef.current = 0;
    };

    // Schedule periodic epoch changes
    const scheduleEpoch = () => {
      const delay = rand(18_000, 30_000);
      epochTimerRef.current = setTimeout(() => {
        startEpochTransition(w, h);
        scheduleEpoch();
      }, delay);
    };
    scheduleEpoch();

    const draw = () => {
      timeRef.current++;
      const t = timeRef.current;
      const cw = canvas.width, ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      // Animate epoch transition crossfade
      if (epochAlphaRef.current < 1) {
        epochAlphaRef.current = Math.min(1, epochAlphaRef.current + 0.006);
      }

      const cfg = configRef.current;
      const eaNew = epochAlphaRef.current;
      const eaOld = 1 - eaNew;

      drawGrid(ctx, cw, ch, cfg, t);
      drawRain(ctx, cw, ch, rainRef.current);
      drawBeams(ctx, cw, ch, beamsRef.current, t);

      // Draw old routes (fading) then new routes (arriving)
      drawCircuits(ctx, prevRoutesRef.current, dotsRef.current, eaOld, -1);
      drawCircuits(ctx, allRoutesRef.current, dotsRef.current, eaNew, epochRef.current);

      drawDataParticles(ctx, cw, ch, dataRef.current);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (epochTimerRef.current) clearTimeout(epochTimerRef.current);
      window.removeEventListener("resize", resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-[2] pointer-events-none" />;
}

// ── Initialisers ──

function initRain(ref: any, cfg: EpochConfig, cw: number, ch: number) {
  const arr = ref.current as RainDrop[];
  while (arr.length < cfg.rainCount) {
    arr.push(spawnRain(cw, ch));
  }
  while (arr.length > cfg.rainCount) arr.pop();
  // Also refresh a portion for visual variety
  for (let i = 0; i < arr.length; i++) {
    if (Math.random() < 0.4) {
      const n = spawnRain(cw, ch);
      arr[i].x = n.x; arr[i].y = n.y;
      arr[i].speed = n.speed; arr[i].length = n.length;
      arr[i].alpha = n.alpha; arr[i].hue = n.hue;
      arr[i].trail = n.trail; arr[i].angle = n.angle;
    }
  }
}

function spawnRain(cw: number, ch: number): RainDrop {
  const angle = rand(-0.15, 0.15);
  return {
    x: rand(0, cw), y: rand(-ch, ch * 0.5),
    speed: rand(1.2, 5.5), length: rand(10, 65),
    alpha: rand(0.04, 0.28), hue: pick(_palette),
    trail: rand(0.25, 0.75), angle,
  };
}

function initData(ref: any, cfg: EpochConfig, cw: number, ch: number) {
  const arr = ref.current as DataParticle[];
  while (arr.length < cfg.dataCount) {
    arr.push(spawnData(cw, ch));
  }
  while (arr.length > cfg.dataCount) arr.pop();
  for (const p of arr) {
    if (Math.random() < 0.35) {
      const n = spawnData(cw, ch); Object.assign(p, n);
    }
  }
}

function spawnData(cw: number, ch: number): DataParticle {
  const side = Math.random();
  let x: number, y: number;
  if (side < 0.35) { x = rand(0, cw * 0.25); y = rand(ch * 0.55, ch); }
  else if (side < 0.7) { x = rand(cw * 0.75, cw); y = rand(ch * 0.55, ch); }
  else { x = rand(0, cw); y = rand(ch * 0.5, ch); }

  const angle = rand(-Math.PI * 0.3, -Math.PI * 0.5);
  const speed = rand(0.2, 1.4);
  return {
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    size: rand(0.4, 3.0), alpha: rand(0.1, 0.6),
    hue: pick(_palette), life: 0, maxLife: rand(120, 550),
  };
}

function initBeams(ref: any, cfg: EpochConfig, cw: number, ch: number) {
  const arr = ref.current as LightBeam[];
  const now = performance.now();
  while (arr.length < cfg.beamCount) {
    arr.push(spawnBeam(cw, ch));
  }
  while (arr.length > cfg.beamCount) arr.pop();
  // Set morph targets for existing beams
  for (const b of arr) {
    b.targetX = rand(cw * 0.03, cw * 0.97);
    b.targetWidth = rand(1.5, 7);
    b.targetHeight = rand(ch * 0.25, ch * 0.85);
    b.morphStart = now;
    b.morphDur = rand(2000, 4000);
  }
}

function spawnBeam(cw: number, ch: number): LightBeam {
  const x = rand(cw * 0.03, cw * 0.97);
  return {
    x, baseWidth: rand(1.5, 7), height: rand(ch * 0.25, ch * 0.85),
    swayPhase: rand(0, Math.PI * 2), swayAmp: rand(5, 35), swaySpeed: rand(0.002, 0.01),
    alpha: rand(0.02, 0.1), hue: pick(_palette),
    targetX: x, targetWidth: rand(1.5, 7), targetHeight: rand(ch * 0.25, ch * 0.85),
    morphStart: performance.now(), morphDur: 3000,
  };
}

function initDots(dots: any, routes: CircuitSegment[][]) {
  const arr = dots.current as CircuitDot[];
  const needed = routes.length * 4;
  while (arr.length < needed) arr.push(spawnDot(routes.length));
  while (arr.length > needed) arr.pop();
  for (const d of arr) {
    d.routeIdx = Math.floor(Math.random() * routes.length);
    d.t = Math.random();
    d.speed = rand(0.0005, 0.003);
    d.hue = pick(_palette);
    d.alpha = rand(0.35, 0.75);
  }
}

function spawnDot(routeCount: number): CircuitDot {
  return {
    routeIdx: Math.floor(Math.random() * routeCount),
    t: Math.random(), speed: rand(0.0005, 0.003),
    size: rand(0.8, 2.5), hue: pick(_palette),
    alpha: rand(0.35, 0.75),
  };
}

// ── Circuit routes ──

function buildCircuitRoutes(cfg: EpochConfig, cw: number, ch: number): CircuitSegment[][] {
  const routes: CircuitSegment[][] = [];

  // Random start zones across the screen
  const zones: { x: number; y: number }[] = [];
  for (let i = 0; i < cfg.routeCount; i++) {
    zones.push({
      x: rand(cw * 0.03, cw * 0.97),
      y: rand(ch * 0.1, ch * 0.9),
    });
  }

  for (let r = 0; r < cfg.routeCount; r++) {
    const segs: CircuitSegment[] = [];
    let px = zones[r].x, py = zones[r].y;
    const steps = Math.floor(rand(4, 12));

    for (let s = 0; s < steps; s++) {
      const dir = pick(["h", "v", "d"]);
      const dist = rand(30, 200);
      let nx = px, ny = py;

      if (dir === "h") { nx = px + (Math.random() > 0.5 ? 1 : -1) * dist; ny = py; }
      else if (dir === "v") { nx = px; ny = py + (Math.random() > 0.5 ? 1 : -1) * dist; }
      else { nx = px + (Math.random() > 0.5 ? 1 : -1) * dist * 0.7; ny = py + (Math.random() > 0.5 ? 1 : -1) * dist * 0.7; }

      nx = Math.max(5, Math.min(cw - 5, nx));
      ny = Math.max(5, Math.min(ch - 5, ny));

      segs.push({ x1: px, y1: py, x2: nx, y2: ny, alpha: rand(0.06, 0.22), epoch: 0 });
      px = nx; py = ny;
    }
    routes.push(segs);
  }
  return routes;
}

// ── Draw functions ──

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cfg: EpochConfig, t: number) {
  const vx = cfg.vanishX + Math.sin(t * 0.0003) * w * 0.03; // subtle drift
  const vy = cfg.vanishY;

  ctx.strokeStyle = `rgba(180, 100, 255, ${cfg.gridAlpha})`;
  ctx.lineWidth = 0.5;

  for (let i = 0; i <= cfg.gridVerticals; i++) {
    const frac = i / cfg.gridVerticals;
    const bottomX = frac * w;
    const cpX = vx + (bottomX - vx) * 0.5;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.quadraticCurveTo(cpX, vy + h * 0.4, bottomX, h);
    ctx.stroke();
  }

  for (let i = 0; i < cfg.gridHorizons; i++) {
    const frac = i / (cfg.gridHorizons - 1);
    const y = vy + frac * frac * (h - vy);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawRain(ctx: CanvasRenderingContext2D, cw: number, ch: number, rain: RainDrop[]) {
  for (const d of rain) {
    d.x += Math.sin(d.angle) * 0.3;
    d.y += d.speed;
    if (d.y > ch + d.length) {
      d.y = rand(-80, -10);
      d.x = rand(0, cw);
      d.speed = rand(1.2, 5.5);
      d.hue = pick(_palette);
    }

    const headY = d.y;
    const tailY = d.y - d.length * d.trail;
    const grad = ctx.createLinearGradient(d.x, tailY, d.x, headY);
    grad.addColorStop(0, `hsla(${d.hue}, 80%, 65%, 0)`);
    grad.addColorStop(0.6, `hsla(${d.hue}, 80%, 65%, ${d.alpha * 0.5})`);
    grad.addColorStop(1, `hsla(${d.hue}, 80%, 75%, ${d.alpha})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(d.x, tailY);
    ctx.lineTo(d.x, headY);
    ctx.stroke();

    ctx.fillStyle = `hsla(${d.hue}, 80%, 85%, ${d.alpha * 1.3})`;
    ctx.beginPath();
    ctx.arc(d.x, headY, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Circuits ──

function drawCircuits(
  ctx: CanvasRenderingContext2D,
  routes: CircuitSegment[][],
  dots: CircuitDot[],
  alphaMul: number,
  currentEpoch: number,
) {
  if (alphaMul <= 0.002 || routes.length === 0) return;

  for (const segs of routes) {
    for (const seg of segs) {
      const a = seg.alpha * alphaMul;
      ctx.strokeStyle = `rgba(160, 120, 220, ${a})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();

      ctx.fillStyle = `rgba(200, 160, 255, ${a * 1.5})`;
      ctx.beginPath();
      ctx.arc(seg.x2, seg.y2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Only draw travelling dots on the current-epoch routes
  if (currentEpoch < 0) return;

  for (const d of dots) {
    d.t += d.speed;
    if (d.t > 1) {
      d.routeIdx = Math.floor(Math.random() * routes.length);
      d.t = 0;
      d.speed = rand(0.0005, 0.003);
      d.hue = pick(_palette);
    }

    const route = routes[d.routeIdx];
    if (!route || route.length === 0) continue;

    let totalLen = 0;
    for (const seg of route) totalLen += Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    let targetDist = d.t * totalLen;
    let px = route[0].x1, py = route[0].y1;
    for (const seg of route) {
      const segLen = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
      if (targetDist <= segLen) {
        const frac = segLen > 0 ? targetDist / segLen : 0;
        px = seg.x1 + (seg.x2 - seg.x1) * frac;
        py = seg.y1 + (seg.y2 - seg.y1) * frac;
        break;
      }
      targetDist -= segLen;
      px = seg.x2; py = seg.y2;
    }

    const a = d.alpha * alphaMul;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, d.size * 4);
    glow.addColorStop(0, `hsla(${d.hue}, 90%, 85%, ${a})`);
    glow.addColorStop(0.5, `hsla(${d.hue}, 80%, 65%, ${a * 0.3})`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, d.size * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsla(${d.hue}, 60%, 95%, ${a})`;
    ctx.beginPath();
    ctx.arc(px, py, d.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Beams ──

function drawBeams(ctx: CanvasRenderingContext2D, w: number, h: number, beams: LightBeam[], t: number) {
  const now = performance.now();

  for (const b of beams) {
    // Morph towards target over time
    if (b.morphStart > 0) {
      const elapsed = now - b.morphStart;
      const frac = Math.min(1, elapsed / b.morphDur);
      if (frac < 1) {
        const e = easeInOutCubic(frac);
        b.x = b.x + (b.targetX - b.x) * e * 0.05;
        b.baseWidth = b.baseWidth + (b.targetWidth - b.baseWidth) * e * 0.05;
        b.height = b.height + (b.targetHeight - b.height) * e * 0.05;
      } else {
        b.x = b.targetX;
        b.baseWidth = b.targetWidth;
        b.height = b.targetHeight;
        b.morphStart = 0;
      }
    }

    const swayX = b.x + Math.sin(t * b.swaySpeed + b.swayPhase) * b.swayAmp;
    const tipY = h - b.height;

    const grad = ctx.createLinearGradient(0, h, 0, tipY);
    grad.addColorStop(0, `hsla(${b.hue}, 80%, 70%, ${b.alpha * 1.2})`);
    grad.addColorStop(0.3, `hsla(${b.hue}, 80%, 65%, ${b.alpha})`);
    grad.addColorStop(0.7, `hsla(${b.hue}, 70%, 55%, ${b.alpha * 0.3})`);
    grad.addColorStop(1, "transparent");

    ctx.fillStyle = grad;
    const hb = b.baseWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(swayX - hb, h);
    ctx.lineTo(swayX - hb * 0.3, tipY);
    ctx.lineTo(swayX + hb * 0.3, tipY);
    ctx.lineTo(swayX + hb, h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `hsla(${b.hue}, 60%, 85%, ${b.alpha * 1.5})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(swayX, h);
    ctx.lineTo(swayX, tipY * 0.5);
    ctx.stroke();
  }
}

// ── Data particles ──

function drawDataParticles(ctx: CanvasRenderingContext2D, cw: number, ch: number, particles: DataParticle[]) {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life++;

    let fade = 1;
    if (p.life < 30) fade = p.life / 30;
    if (p.life > p.maxLife - 40) fade = (p.maxLife - p.life) / 40;
    const alpha = p.alpha * Math.max(0, fade);

    if (p.life >= p.maxLife || p.y < -20 || p.x < -20 || p.x > cw + 20) {
      const fresh = spawnData(cw, ch);
      Object.assign(p, fresh);
      continue;
    }

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
    glow.addColorStop(0, `hsla(${p.hue}, 90%, 80%, ${alpha})`);
    glow.addColorStop(0.4, `hsla(${p.hue}, 80%, 65%, ${alpha * 0.6})`);
    glow.addColorStop(1, `hsla(${p.hue}, 70%, 50%, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsla(${p.hue}, 60%, 90%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
