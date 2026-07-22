/**
 * SceneManager — 场景加载/卸载/切换，相机管理，光照管理。
 *
 * 职责：
 * - 场景树管理（场景节点、Mesh 列表）
 * - 相机状态（position、target、fov、约束）
 * - 光照管理（ambient、point、directional）
 * - 场景热切换（资源释放 → 新场景加载 → 恢复交互）
 *
 * Ref: [05_渲染管线 §4, §7](docs/webgl3d-spec/05_3D场景通用渲染管线规范.md)
 */

import { mat4, vec3 } from "gl-matrix";

// ─── Types ────────────────────────────────────────────────────────────

export interface CameraConfig {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  nearPlane: number;
  farPlane: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

export interface LightConfig {
  id: string;
  type: "ambient" | "point" | "directional";
  position?: [number, number, number];
  direction?: [number, number, number];
  color: [number, number, number];
  intensity: number;
  range?: number;
  castShadow?: boolean;
}

export interface SceneNode {
  id: string;
  name: string;
  modelRef: string;
  hdModelRef?: string;
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number]; // euler, radians
  scale: [number, number, number];
  children: SceneNode[];
  extras?: Record<string, unknown>;
}

export interface SceneConfig {
  id: string;
  nameKey: string;
  descriptionKey: string;
  modelRef: string;
  hdModelRef?: string;
  defaultCamera: CameraConfig;
  lights: LightConfig[];
  nodes: SceneNode[];
  postProcessing?: PostProcessConfig;
  particleSystems?: ParticleSystemConfig[];
}

export interface PostProcessConfig {
  bloom?: { threshold: number; strength: number; radius: number };
  colorGrading?: { lookupTextureRef: string };
  vignette?: { strength: number; color: [number, number, number] };
  chromaticAberration?: { strength: number };
  grain?: { strength: number; size: number };
}

export interface ParticleSystemConfig {
  id: string;
  emitter: {
    position: [number, number, number];
    shape: "box" | "sphere" | "cone";
    size: [number, number, number];
  };
  particle: {
    textureRef: string;
    maxCount: number;
    lifetime: [number, number];
  };
}

const DEFAULT_CAMERA: CameraConfig = {
  position: [0, 1.5, 5],
  target: [0, 1, 0],
  fov: 60,
  nearPlane: 0.1,
  farPlane: 100,
  minDistance: 1,
  maxDistance: 10,
  minPolarAngle: 0.1,
  maxPolarAngle: 1.5,
};

// ─── SceneManager ─────────────────────────────────────────────────────

export class SceneManager {
  private scenes = new Map<string, SceneConfig>();
  private currentSceneId: string | null = null;
  private camera: {
    position: vec3;
    target: vec3;
    fov: number;
    near: number;
    far: number;
  };
  private activeLights: LightConfig[] = [];
  private activePostProcess: PostProcessConfig | null = null;
  private activeParticles: ParticleSystemConfig[] = [];

  // Matrices (recomputed each frame)
  private viewMatrix = mat4.create();
  private projectionMatrix = mat4.create();
  private viewProjMatrix = mat4.create();
  private dirty = true; // view/proj need recompute

  constructor() {
    this.camera = {
      position: vec3.fromValues(...DEFAULT_CAMERA.position),
      target: vec3.fromValues(...DEFAULT_CAMERA.target),
      fov: DEFAULT_CAMERA.fov,
      near: DEFAULT_CAMERA.nearPlane,
      far: DEFAULT_CAMERA.farPlane,
    };
  }

  // ── Scene registration ────────────────────────────────────────────

  registerScene(config: SceneConfig): void {
    this.scenes.set(config.id, config);
  }

  unregisterScene(id: string): void {
    this.scenes.delete(id);
  }

  getScene(id: string): SceneConfig | undefined {
    return this.scenes.get(id);
  }

  // ── Scene switching ───────────────────────────────────────────────

  getCurrentSceneId(): string | null {
    return this.currentSceneId;
  }

  /**
   * 切换到指定场景。
   * 返回需要加载/释放的资源引用，由调用方配合 ResourceCache 执行实际的资源加载。
   */
  async switchScene(sceneId: string): Promise<{ unload: string[]; load: string[] }> {
    const config = this.scenes.get(sceneId);
    if (!config) {
      throw new Error(`Scene "${sceneId}" not registered`);
    }

    // Compute resource diff
    const unload: string[] = [];
    const load: string[] = [];

    if (this.currentSceneId) {
      const oldConfig = this.scenes.get(this.currentSceneId);
      if (oldConfig) {
        unload.push(oldConfig.modelRef);
        if (oldConfig.hdModelRef) unload.push(oldConfig.hdModelRef);
      }
    }

    load.push(config.modelRef);
    if (config.hdModelRef) load.push(config.hdModelRef);

    // Collect all node model refs
    const collectRefs = (nodes: SceneNode[]): string[] => {
      const refs: string[] = [];
      for (const n of nodes) {
        refs.push(n.modelRef);
        if (n.hdModelRef) refs.push(n.hdModelRef);
        refs.push(...collectRefs(n.children));
      }
      return refs;
    };
    load.push(...collectRefs(config.nodes));

    // Apply camera
    this.camera.position = vec3.fromValues(...config.defaultCamera.position);
    this.camera.target = vec3.fromValues(...config.defaultCamera.target);
    this.camera.fov = config.defaultCamera.fov;
    this.camera.near = config.defaultCamera.nearPlane;
    this.camera.far = config.defaultCamera.farPlane;
    this.dirty = true;

    // Apply lights
    this.activeLights = config.lights;

    // Apply post-processing
    this.activePostProcess = config.postProcessing ?? null;

    // Apply particles
    this.activeParticles = config.particleSystems ?? [];

    this.currentSceneId = sceneId;

    return { unload, load };
  }

  // ── Camera ──────────────────────────────────────────────────────────

  getCamera() {
    return {
      position: vec3.clone(this.camera.position),
      target: vec3.clone(this.camera.target),
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far,
    };
  }

  setCameraPosition(pos: vec3, target: vec3): void {
    vec3.copy(this.camera.position, pos);
    vec3.copy(this.camera.target, target);
    this.dirty = true;
  }

  orbitCamera(deltaAzimuth: number, deltaPolar: number): void {
    const dir = vec3.sub(vec3.create(), this.camera.position, this.camera.target);
    const dist = vec3.len(dir);
    vec3.normalize(dir, dir);

    // Decompose current angles
    const azimuth = Math.atan2(dir[0], dir[2]);
    const polar = Math.acos(dir[1]);

    // Apply delta (clamped)
    const newPolar = Math.max(0.1, Math.min(Math.PI - 0.1, polar + deltaPolar));
    const newAzimuth = azimuth + deltaAzimuth;

    // Recompute position
    this.camera.position[0] = this.camera.target[0] + dist * Math.sin(newPolar) * Math.sin(newAzimuth);
    this.camera.position[1] = this.camera.target[1] + dist * Math.cos(newPolar);
    this.camera.position[2] = this.camera.target[2] + dist * Math.sin(newPolar) * Math.cos(newAzimuth);

    this.dirty = true;
  }

  zoomCamera(delta: number): void {
    const dir = vec3.sub(vec3.create(), this.camera.position, this.camera.target);
    const dist = vec3.len(dir);
    const newDist = Math.max(DEFAULT_CAMERA.minDistance, Math.min(DEFAULT_CAMERA.maxDistance, dist * (1 - delta * 0.01)));
    vec3.normalize(dir, dir);
    vec3.scaleAndAdd(this.camera.position, this.camera.target, dir, newDist);
    this.dirty = true;
  }

  // ── Matrices ───────────────────────────────────────────────────────

  getViewMatrix(aspectRatio: number): { view: mat4; proj: mat4; viewProj: mat4 } {
    if (this.dirty) {
      mat4.lookAt(this.viewMatrix, this.camera.position, this.camera.target, [0, 1, 0]);
      mat4.perspective(this.projectionMatrix, (this.camera.fov * Math.PI) / 180, aspectRatio, this.camera.near, this.camera.far);
      mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);
      this.dirty = false;
    }
    return {
      view: this.viewMatrix,
      proj: this.projectionMatrix,
      viewProj: this.viewProjMatrix,
    };
  }

  markDirty(): void {
    this.dirty = true;
  }

  // ── Lights ──────────────────────────────────────────────────────────

  getLights(): LightConfig[] {
    return this.activeLights;
  }

  // ── Post-processing ────────────────────────────────────────────────

  getPostProcessConfig(): PostProcessConfig | null {
    return this.activePostProcess;
  }

  // ── Particles ──────────────────────────────────────────────────────

  getParticleSystems(): ParticleSystemConfig[] {
    return this.activeParticles;
  }

  // ── Node traversal ─────────────────────────────────────────────────

  getActiveNodes(): SceneNode[] {
    const config = this.currentSceneId ? this.scenes.get(this.currentSceneId) : null;
    if (!config) return [];
    return config.nodes;
  }

  /** Flatten node tree into renderable list */
  flattenNodes(parentTransform?: mat4): { node: SceneNode; worldMatrix: mat4 }[] {
    const config = this.currentSceneId ? this.scenes.get(this.currentSceneId) : null;
    if (!config) return [];

    const result: { node: SceneNode; worldMatrix: mat4 }[] = [];
    const base = parentTransform ?? mat4.create();

    const walk = (nodes: SceneNode[], parentM: mat4) => {
      for (const node of nodes) {
        if (!node.visible) continue;
        const local = mat4.create();
        mat4.translate(local, local, node.position);
        mat4.rotateX(local, local, node.rotation[0]);
        mat4.rotateY(local, local, node.rotation[1]);
        mat4.rotateZ(local, local, node.rotation[2]);
        mat4.scale(local, local, node.scale);
        const world = mat4.multiply(mat4.create(), parentM, local);
        result.push({ node, worldMatrix: world });
        walk(node.children, world);
      }
    };

    walk(config.nodes, base);
    return result;
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  dispose(): void {
    this.scenes.clear();
    this.currentSceneId = null;
    this.activeLights = [];
    this.activePostProcess = null;
    this.activeParticles = [];
  }
}
