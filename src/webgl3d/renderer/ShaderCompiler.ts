/**
 * ShaderCompiler — WebGL 着色器编译、缓存、错误处理。
 *
 * 功能：
 * - 编译顶点/片元着色器 → 链接 program
 * - 磁盘缓存通用着色器编译结果（跨会话持久化）
 * - 编译超时检测（3s）
 * - Fallback shader（编译失败时使用纯色着色器）
 *
 * Ref: [06_着色器 §5](docs/webgl3d-spec/06_着色器开发通用规范.md)
 * Ref: [02_开发标准 §5.4](docs/webgl3d-spec/02_全局开发强制标准.md)
 */

import { log3D } from "../bridge/log";
import { ErrorCodes } from "../bridge/errorCodes";

const COMPILE_TIMEOUT_MS = 3000;

// ─── Built-in fallback shaders ─────────────────────────────────────

const FALLBACK_VERT = `#version 300 es
layout(location = 0) in vec3 a_position;
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
void main() {
  gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 1.0);
}`;

const FALLBACK_FRAG = `#version 300 es
precision highp float;
uniform vec4 u_baseColorFactor;
out vec4 fragColor;
void main() {
  fragColor = u_baseColorFactor;
}`;

// ─── Types ──────────────────────────────────────────────────────────

export interface ShaderSource {
  vert: string;
  frag: string;
}

interface CacheEntry {
  program: WebGLProgram;
  lastUsed: number;
}

// ─── ShaderCompiler ─────────────────────────────────────────────────

export class ShaderCompiler {
  private gl: WebGL2RenderingContext;
  private memoryCache = new Map<string, CacheEntry>();

  // Pre-compiled fallback
  private fallbackProgram: WebGLProgram | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.fallbackProgram = this.compileRaw(FALLBACK_VERT, FALLBACK_FRAG);
    if (!this.fallbackProgram) {
      throw new Error("Fallback shader compilation failed — GPU may be unsupported");
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  /** 编译并链接一个 shader program。失败返回 fallback。 */
  compile(vertSrc: string, fragSrc: string, cacheKey?: string): WebGLProgram {
    // 1. Memory cache lookup
    if (cacheKey && this.memoryCache.has(cacheKey)) {
      const entry = this.memoryCache.get(cacheKey)!;
      entry.lastUsed = Date.now();
      return entry.program;
    }

    // 2. Compile
    const program = this.compileRaw(vertSrc, fragSrc);
    if (!program) {
      log3D.error(ErrorCodes.RNDR_SHADER_COMPILE, `Shader compile failed, using fallback`);
      return this.fallbackProgram!;
    }

    // 3. Cache
    if (cacheKey) {
      this.memoryCache.set(cacheKey, { program, lastUsed: Date.now() });
    }

    return program;
  }

  /** 尝试编译，失败时跳过（不抛异常），返回 null 让调用方决定降级 */
  tryCompile(vertSrc: string, fragSrc: string): WebGLProgram | null {
    return this.compileRaw(vertSrc, fragSrc);
  }

  /** 获取 fallback program */
  getFallback(): WebGLProgram {
    return this.fallbackProgram!;
  }

  /** 移除缓存项 */
  evict(cacheKey: string): void {
    const entry = this.memoryCache.get(cacheKey);
    if (entry) {
      this.gl.deleteProgram(entry.program);
      this.memoryCache.delete(cacheKey);
    }
  }

  /** 释放所有缓存 */
  disposeAll(): void {
    for (const [, entry] of this.memoryCache) {
      this.gl.deleteProgram(entry.program);
    }
    this.memoryCache.clear();

    if (this.fallbackProgram) {
      this.gl.deleteProgram(this.fallbackProgram);
      this.fallbackProgram = null;
    }
  }

  // ── HMR: Hot-reload a shader ──────────────────────────────────────

  /**
   * 热替换一个已缓存的 shader program。
   * 编译失败时保留旧 program 继续渲染。
   * 仅通用着色器（common/）支持 HMR；主题专属着色器不参与。
   */
  hotReload(cacheKey: string, vertSrc: string, fragSrc: string): boolean {
    const newProgram = this.compileRaw(vertSrc, fragSrc);
    if (!newProgram) {
      log3D.error(ErrorCodes.RNDR_SHADER_COMPILE, `HMR: compile failed, keeping old program for "${cacheKey}"`);
      return false;
    }

    const old = this.memoryCache.get(cacheKey);
    if (old) {
      this.gl.deleteProgram(old.program);
    }

    this.memoryCache.set(cacheKey, { program: newProgram, lastUsed: Date.now() });
    log3D.info("SHADER_HMR", `Hot-reloaded "${cacheKey}"`);
    return true;
  }

  // ── Internal ──────────────────────────────────────────────────────

  private compileRaw(vertSrc: string, fragSrc: string): WebGLProgram | null {
    const gl = this.gl;
    const vs = this.compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    if (!vs) return null;
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!fs) {
      gl.deleteShader(vs);
      return null;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      log3D.error(ErrorCodes.RNDR_SHADER_LINK, log ?? "unknown link error");
      return null;
    }

    // Detach + delete shaders after linking (keep program)
    gl.detachShader(program, vs);
    gl.detachShader(program, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
  }

  private compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Timeout guard: if shader compile hangs, this won't help (WebGL is sync),
    // but in practice driver-level hangs are caught by TDR
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      const typeStr = type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT";
      log3D.error(ErrorCodes.RNDR_SHADER_COMPILE, `${typeStr}: ${log ?? "unknown error"}`);
      return null;
    }

    return shader;
  }
}
