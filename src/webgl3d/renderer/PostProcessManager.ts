/**
 * PostProcessManager — 后处理效果管线。
 *
 * 支持：Bloom、LUT 调色、Vignette、Chromatic Aberration、Film Grain
 * 全部可独立开关，按序执行。
 *
 * Ref: [06_着色器 §3-4](docs/webgl3d-spec/06_着色器开发通用规范.md)
 * Ref: [11_Schema §4.2](docs/webgl3d-spec/11_主题元数据通用Schema标准.md)
 */

export interface BloomConfig {
  threshold: number;
  strength: number;
  radius: number;
}

export interface PostProcessConfig {
  bloom?: BloomConfig;
  lut?: { texture: WebGLTexture };
  vignette?: { strength: number; color: [number, number, number] };
  chromaticAberration?: { strength: number };
  grain?: { strength: number; size: number };
}

// ─── Shader sources ──────────────────────────────────────────────────

const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform int u_horizontal;
out vec4 fragColor;
void main() {
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 r = texture(u_texture, v_uv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = u_horizontal != 0 ? vec2(float(u_texelSize.x) * float(i), 0.0) : vec2(0.0, float(u_texelSize.y) * float(i));
    r += texture(u_texture, v_uv + o).rgb * w[i];
    r += texture(u_texture, v_uv - o).rgb * w[i];
  }
  fragColor = vec4(r, 1.0);
}`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomStrength;
out vec4 fragColor;
void main() {
  vec3 scene = texture(u_scene, v_uv).rgb;
  vec3 bloom = texture(u_bloom, v_uv).rgb;
  fragColor = vec4(scene + bloom * u_bloomStrength, 1.0);
}`;

const LUT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform sampler2D u_lut;
out vec4 fragColor;
vec3 lookup(vec3 color, sampler2D lutTex) {
  float size = 32.0;
  float b = color.b * (size - 1.0);
  float b0 = floor(b), b1 = min(b0 + 1.0, size - 1.0);
  float fb = b - b0;
  vec2 uv0 = vec2((b0 + color.r * (size - 1.0)) / (size * size), color.g);
  vec2 uv1 = vec2((b1 + color.r * (size - 1.0)) / (size * size), color.g);
  return mix(texture(lutTex, uv0).rgb, texture(lutTex, uv1).rgb, fb);
}
void main() {
  vec3 color = texture(u_texture, v_uv).rgb;
  fragColor = vec4(lookup(color, u_lut), 1.0);
}`;

const VIGNETTE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_strength;
uniform vec3 u_color;
out vec4 fragColor;
void main() {
  vec3 color = texture(u_texture, v_uv).rgb;
  float d = length(v_uv - 0.5);
  float vig = 1.0 - d * u_strength;
  fragColor = vec4(mix(u_color, color, vig), 1.0);
}`;

const CA_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_strength;
out vec4 fragColor;
void main() {
  vec2 dir = v_uv - 0.5;
  float d = length(dir);
  float r = texture(u_texture, v_uv + dir * u_strength * 0.01).r;
  float g = texture(u_texture, v_uv).g;
  float b = texture(u_texture, v_uv - dir * u_strength * 0.01).b;
  fragColor = vec4(r, g, b, 1.0);
}`;

const GRAIN_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_strength;
uniform float u_size;
uniform float u_time;
out vec4 fragColor;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec3 color = texture(u_texture, v_uv).rgb;
  float grain = hash(floor(v_uv * u_size) + u_time) * 2.0 - 1.0;
  fragColor = vec4(color + grain * u_strength * 0.05, 1.0);
}`;

// ─── Framebuffer pool ────────────────────────────────────────────────

interface FbEntry {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

// ─── PostProcessManager ──────────────────────────────────────────────

export class PostProcessManager {
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, WebGLProgram>();
  private fullscreenVao: WebGLVertexArrayObject;

  // Bloom intermediates
  private blurFb1: FbEntry | null = null;
  private blurFb2: FbEntry | null = null;

  constructor(gl: WebGL2RenderingContext, compileShader: (vsName: string, fsSrc: string) => WebGLProgram) {
    this.gl = gl;
    this.programs.set("blur", compileShader("fullscreen.vert", BLUR_FRAG));
    this.programs.set("composite", compileShader("fullscreen.vert", COMPOSITE_FRAG));
    this.programs.set("lut", compileShader("fullscreen.vert", LUT_FRAG));
    this.programs.set("vignette", compileShader("fullscreen.vert", VIGNETTE_FRAG));
    this.programs.set("ca", compileShader("fullscreen.vert", CA_FRAG));
    this.programs.set("grain", compileShader("fullscreen.vert", GRAIN_FRAG));

    // Fullscreen triangle VAO
    const tri = new Float32Array([-1, -1, 3, -1, -1, 3]);
    this.fullscreenVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.fullscreenVao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, tri, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  // ── Bloom ───────────────────────────────────────────────────────────

  private ensureBlurFbs(w: number, h: number): void {
    const hw = Math.floor(w / 2), hh = Math.floor(h / 2);
    if (this.blurFb1) {
      this.resizeFb(this.blurFb1, hw, hh);
      this.resizeFb(this.blurFb2!, hw, hh);
    } else {
      this.blurFb1 = this.createFb(hw, hh);
      this.blurFb2 = this.createFb(hw, hh);
    }
  }

  applyBloom(sceneTex: WebGLTexture, config: BloomConfig, width: number, height: number): WebGLTexture {
    const gl = this.gl;
    this.ensureBlurFbs(width, height);
    const hw = Math.floor(width / 2), hh = Math.floor(height / 2);

    const blurProg = this.programs.get("blur")!;
    const compositeProg = this.programs.get("composite")!;

    gl.useProgram(blurProg);
    gl.bindVertexArray(this.fullscreenVao);
    gl.activeTexture(gl.TEXTURE0);
    const uTex = gl.getUniformLocation(blurProg, "u_texture");
    const uTexel = gl.getUniformLocation(blurProg, "u_texelSize");
    const uHoriz = gl.getUniformLocation(blurProg, "u_horizontal");

    // Horizontal blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFb1!.fbo);
    gl.viewport(0, 0, hw, hh);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(uTex, 0);
    gl.uniform2f(uTexel, 1 / width, 1 / height);
    gl.uniform1i(uHoriz, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Vertical blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFb2!.fbo);
    gl.bindTexture(gl.TEXTURE_2D, this.blurFb1!.tex);
    gl.uniform2f(uTexel, 1 / hw, 1 / hh);
    gl.uniform1i(uHoriz, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(compositeProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(gl.getUniformLocation(compositeProg, "u_scene"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurFb2!.tex);
    gl.uniform1i(gl.getUniformLocation(compositeProg, "u_bloom"), 1);
    gl.uniform1f(gl.getUniformLocation(compositeProg, "u_bloomStrength"), config.strength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    return gl.getParameter(gl.FRAMEBUFFER_BINDING) as unknown as WebGLTexture;
  }

  // ── Individual effects ──────────────────────────────────────────────

  applyLUT(inputTex: WebGLTexture, lutTex: WebGLTexture, w: number, h: number): void {
    this.fullscreenPass("lut", (gl, prog) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform1i(gl.getUniformLocation(prog, "u_texture"), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, lutTex);
      gl.uniform1i(gl.getUniformLocation(prog, "u_lut"), 1);
    }, w, h);
  }

  applyVignette(inputTex: WebGLTexture, strength: number, color: [number, number, number], w: number, h: number): void {
    this.fullscreenPass("vignette", (gl, prog) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform1i(gl.getUniformLocation(prog, "u_texture"), 0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_strength"), strength);
      gl.uniform3f(gl.getUniformLocation(prog, "u_color"), ...color);
    }, w, h);
  }

  applyCA(inputTex: WebGLTexture, strength: number, w: number, h: number): void {
    this.fullscreenPass("ca", (gl, prog) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform1i(gl.getUniformLocation(prog, "u_texture"), 0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_strength"), strength);
    }, w, h);
  }

  applyGrain(inputTex: WebGLTexture, strength: number, size: number, time: number, w: number, h: number): void {
    this.fullscreenPass("grain", (gl, prog) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform1i(gl.getUniformLocation(prog, "u_texture"), 0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_strength"), strength);
      gl.uniform1f(gl.getUniformLocation(prog, "u_size"), size);
      gl.uniform1f(gl.getUniformLocation(prog, "u_time"), time);
    }, w, h);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private fullscreenPass(
    programKey: string,
    bind: (gl: WebGL2RenderingContext, prog: WebGLProgram) => void,
    w: number, h: number
  ): void {
    const gl = this.gl;
    const prog = this.programs.get(programKey);
    if (!prog) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(prog);
    bind(gl, prog);
    gl.bindVertexArray(this.fullscreenVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private createFb(w: number, h: number): FbEntry {
    const gl = this.gl;
    const fbo = gl.createFramebuffer()!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex };
  }

  private resizeFb(fb: FbEntry, w: number, h: number): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, fb.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const [, prog] of this.programs) gl.deleteProgram(prog);
    this.programs.clear();
    gl.deleteVertexArray(this.fullscreenVao);
    [this.blurFb1, this.blurFb2].forEach(fb => {
      if (fb) {
        gl.deleteFramebuffer(fb.fbo);
        gl.deleteTexture(fb.tex);
      }
    });
  }
}
