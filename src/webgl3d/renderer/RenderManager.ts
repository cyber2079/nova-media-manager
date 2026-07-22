/**
 * RenderManager — 全局单例，唯一 WebGL context 持有者。
 *
 * 职责：
 * - 全局唯一 WebGL 2.0 Context 的创建 / 销毁
 * - Context Lost 被动恢复（5s 时间预算）
 * - 渲染循环启停与帧率控制
 * - 性能模式切换
 *
 * Ref: [05_渲染管线 §2-3](docs/webgl3d-spec/05_3D场景通用渲染管线规范.md)
 * Ref: [04_分层架构 §2.3](docs/webgl3d-spec/04_WebGL三层分层架构文档.md)
 */

import { log3D } from "../bridge/log";
import { ErrorCodes } from "../bridge/errorCodes";

export type PerformanceMode = "quality" | "balanced" | "powersave";
export type RenderState = "uninitialized" | "active" | "degraded" | "recovering" | "disabled";

export interface RenderCallbacks {
  onStateChange?: (state: RenderState) => void;
  onFpsUpdate?: (fps: number) => void;
  onFrame?: (dt: number) => void; // called each frame for scene update
}

const RECOVERY_TIMEOUT_MS = 5000;
const SHADER_REBUILD_TIMEOUT_MS = 3000;
const TEXTURE_REBUILD_TIMEOUT_MS = 2000;

export class RenderManager {
  private static instance: RenderManager;

  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private rafId = 0;
  private lastTimestamp = 0;
  private state: RenderState = "uninitialized";
  private mode: PerformanceMode = "quality";
  private callbacks: RenderCallbacks = {};

  // Recovery state
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshot: SceneSnapshot | null = null;

  // FPS tracking
  private frameCount = 0;
  private lastFpsTime = 0;

  // Idle detection
  private lastInteractionTime = 0;
  private idleTimeout = 10_000; // 10s

  private constructor() {}

  // ── Singleton ─────────────────────────────────────────────────────

  static getInstance(): RenderManager {
    if (!RenderManager.instance) {
      RenderManager.instance = new RenderManager();
    }
    return RenderManager.instance;
  }

  // ── Context lifecycle ─────────────────────────────────────────────

  getContext(): WebGL2RenderingContext | null {
    return this.gl;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getState(): RenderState {
    return this.state;
  }

  createContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
    if (this.gl && !this.gl.isContextLost()) {
      throw new Error("WebGL context already exists. Destroy first.");
    }

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      log3D.error(ErrorCodes.RNDR_CTX_CREATE, "WebGL 2.0 not available");
      throw new Error("WebGL 2.0 not available");
    }

    this.gl = gl;
    this.canvas = canvas;
    this.state = "active";

    // Register context lost/restore handlers
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);

    log3D.info("RNDR_CTX_INIT", `WebGL context created`);
    return gl;
  }

  destroyContext(): void {
    this.stopLoop();
    if (!this.gl) return;

    this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas?.removeEventListener("webglcontextrestored", this.onContextRestored);

    const ext = this.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    this.gl = null;
    this.canvas = null;
    this.state = "uninitialized";
  }

  // ── Context Lost / Restore ────────────────────────────────────────

  private onContextLost = (event: Event): void => {
    event.preventDefault(); // tell browser we want to restore
    this.stopLoop();
    this.captureSnapshot();
    this.state = "recovering";
    this.callbacks.onStateChange?.("recovering");

    log3D.warn(ErrorCodes.RNDR_CTX_LOST, "WebGL context lost — entering recovery");

    this.recoveryTimer = setTimeout(() => {
      log3D.error(ErrorCodes.RNDR_CTX_RESTORE_FAIL, "Recovery timeout — degrading");
      this.state = "degraded";
      this.callbacks.onStateChange?.("degraded");
    }, RECOVERY_TIMEOUT_MS);
  };

  private onContextRestored = (): void => {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    const gl = this.gl!;
    const restoreStart = performance.now();

    try {
      // Phase 1: rebuild shader programs (≤ 3s)
      const shaderDone = this.rebuildShaders(gl);
      if (!shaderDone || performance.now() - restoreStart > SHADER_REBUILD_TIMEOUT_MS) {
        log3D.warn(ErrorCodes.RNDR_CTX_RESTORE_FAIL, "Shader rebuild timed out");
        this.degrade();
        return;
      }

      // Phase 2: rebuild textures + buffers (≤ 2s)
      const texturesDone = this.rebuildResources(gl);
      if (!texturesDone || performance.now() - restoreStart > SHADER_REBUILD_TIMEOUT_MS + TEXTURE_REBUILD_TIMEOUT_MS) {
        log3D.warn(ErrorCodes.RNDR_CTX_RESTORE_FAIL, "Resource rebuild timed out");
        this.degrade();
        return;
      }

      // Restore scene state
      this.restoreSnapshot();
      this.state = "active";
      this.callbacks.onStateChange?.("active");
      this.startLoop();

      log3D.info("RNDR_CTX_RESTORED", `Recovered in ${(performance.now() - restoreStart).toFixed(0)}ms`);
    } catch (e) {
      log3D.error(ErrorCodes.RNDR_CTX_RESTORE_FAIL, String(e));
      this.degrade();
    }
  };

  private degrade(): void {
    this.state = "degraded";
    this.callbacks.onStateChange?.("degraded");
  }

  private captureSnapshot(): void {
    // Store minimal state for recovery — camera, scene ID, interaction state
    this.snapshot = {
      sceneId: null, // populated by SceneManager if active
      timestamp: performance.now(),
    };
  }

  private rebuildShaders(_gl: WebGL2RenderingContext): boolean {
    // Delegate to ShaderCompiler.rebuildAll()
    // Returns true if all shaders rebuilt within budget
    // TODO: wired to ShaderCompiler in next iteration
    return true;
  }

  private rebuildResources(_gl: WebGL2RenderingContext): boolean {
    // Delegate to ResourceCache.rebuildAll()
    // TODO: wired to ResourceCache in next iteration
    return true;
  }

  private restoreSnapshot(): void {
    // Restore scene to pre-loss state
    // TODO: wired to SceneManager when implemented
  }

  // ── Render loop ───────────────────────────────────────────────────

  setCallbacks(cbs: RenderCallbacks): void {
    this.callbacks = cbs;
  }

  setPerformanceMode(mode: PerformanceMode): void {
    this.mode = mode;
  }

  markInteraction(): void {
    this.lastInteractionTime = performance.now();
  }

  startLoop(): void {
    if (this.rafId !== 0) return;
    this.lastTimestamp = performance.now();
    this.lastFpsTime = this.lastTimestamp;
    this.frameCount = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stopLoop(): void {
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private frame = (now: number): void => {
    // Check: is module disabled?
    if (this.state === "disabled" || this.state === "uninitialized") return;

    // Check: context lost?
    if (this.gl?.isContextLost()) return;

    // Idle / focus check
    const dt = now - this.lastTimestamp;
    this.lastTimestamp = now;

    // FPS tracking
    this.frameCount++;
    if (now - this.lastFpsTime >= 1000) {
      const fps = Math.round(this.frameCount / ((now - this.lastFpsTime) / 1000));
      this.frameCount = 0;
      this.lastFpsTime = now;
      this.callbacks.onFpsUpdate?.(fps);
    }

    // Call scene update
    this.callbacks.onFrame?.(dt / 1000);

    this.rafId = requestAnimationFrame(this.frame);
  };

  // ── Resize ────────────────────────────────────────────────────────

  resize(width: number, height: number, dpr: number = 1): void {
    const canvas = this.canvas;
    if (!canvas || !this.gl) return;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // ── Dispose ───────────────────────────────────────────────────────

  disposeAll(): void {
    this.stopLoop();
    this.snapshot = null;
    // ResourceCache.disposeAll() — wired later
    // ShaderCompiler.disposeAll() — wired later
  }
}

interface SceneSnapshot {
  sceneId: string | null;
  timestamp: number;
}
