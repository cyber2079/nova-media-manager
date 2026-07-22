/**
 * MetricsCollector — 渲染性能指标采集。
 *
 * 采集指标：FPS、帧时间、JS Heap、DrawCall 数、三角面数、纹理数
 * 开发环境通过 Stats.js 显示；生产环境仅用于内部降级判断。
 *
 * Ref: [05_渲染管线 §10](docs/webgl3d-spec/05_3D场景通用渲染管线规范.md)
 * Ref: [02_开发标准 §5.1](docs/webgl3d-spec/02_全局开发强制标准.md)
 */

export interface MetricsSnapshot {
  fps: number;
  frameTimeMs: number;
  jsHeapMB: number;
  drawCalls: number;
  triangleCount: number;
  textureCount: number;
  contextLostCount: number;
}

type MetricsListener = (m: MetricsSnapshot) => void;

const SAMPLE_INTERVAL_MS = 1000;

export class MetricsCollector {
  private listeners = new Set<MetricsListener>();

  // Current values (updated externally)
  private _fps = 0;
  private _frameTimeMs = 0;
  private _drawCalls = 0;
  private _triangleCount = 0;
  private _textureCount = 0;
  private _contextLostCount = 0;

  // Internal tracking
  private frameCount = 0;
  private frameTimeAcc = 0;
  private lastSampleTime = performance.now();
  private lastFrameTime = performance.now();
  private sampleTimer: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────

  start(): void {
    this.lastSampleTime = performance.now();
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.frameTimeAcc = 0;
    this.sampleTimer = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
  }

  stop(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
  }

  // ── Per-frame input (call from render loop) ────────────────────────

  recordFrame(): void {
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;
    this.frameTimeAcc += dt;
  }

  setSceneStats(drawCalls: number, triangles: number, textures: number): void {
    this._drawCalls = drawCalls;
    this._triangleCount = triangles;
    this._textureCount = textures;
  }

  incrementContextLost(): void {
    this._contextLostCount++;
  }

  // ── Snapshot ───────────────────────────────────────────────────────

  getSnapshot(): MetricsSnapshot {
    return {
      fps: this._fps,
      frameTimeMs: this._frameTimeMs,
      jsHeapMB: this.readJsHeapMB(),
      drawCalls: this._drawCalls,
      triangleCount: this._triangleCount,
      textureCount: this._textureCount,
      contextLostCount: this._contextLostCount,
    };
  }

  subscribe(fn: MetricsListener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  // ── Internal ──────────────────────────────────────────────────────

  private sample(): void {
    const now = performance.now();
    const elapsed = now - this.lastSampleTime;
    this._fps = Math.round(this.frameCount / (elapsed / 1000));
    this._frameTimeMs = this.frameCount > 0
      ? Math.round((this.frameTimeAcc / this.frameCount) * 100) / 100
      : 0;

    this.frameCount = 0;
    this.frameTimeAcc = 0;
    this.lastSampleTime = now;

    const snapshot = this.getSnapshot();
    for (const fn of this.listeners) {
      fn(snapshot);
    }
  }

  private readJsHeapMB(): number {
    const mem = (performance as any).memory;
    if (!mem) return 0;
    return Math.round(mem.usedJSHeapSize / 1024 / 1024);
  }
}
