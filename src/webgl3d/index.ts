/**
 * src/webgl3d/index.ts — 3D 扩展模块唯一公开入口。
 *
 * 主应用仅通过本文件接触 3D 模块。不直接 import 内部实现。
 * 所有对外接口遵循 ThreeDModuleAPI 契约。
 *
 * Ref: [04_分层架构 §2.1](docs/webgl3d-spec/04_WebGL三层分层架构文档.md)
 */

import { WEBGL3D_ENABLED } from "./featureFlag";
import { RenderManager, type PerformanceMode, type RenderState } from "./renderer/RenderManager";
import { CircuitBreaker } from "./renderer/CircuitBreaker";
import { ResourceCache } from "./renderer/ResourceCache";
import { ShaderCompiler } from "./renderer/ShaderCompiler";
import { MetricsCollector } from "./renderer/MetricsCollector";
import { SceneManager } from "./renderer/SceneManager";
import { PostProcessManager } from "./renderer/PostProcessManager";
import { RayPicker } from "./interaction/RayPicker";
import { AnimationController } from "./interaction/AnimationController";
import { EventBus } from "./interaction/EventBus";
import { InteractionResolver } from "./interaction/InteractionResolver";
import type { ActionHandlers, GameStateView } from "./interaction/InteractionResolver";
import { log3D } from "./bridge/log";

// ─── Public API (matches ThreeDModuleAPI from 04 doc) ───────────────

export { WEBGL3D_ENABLED };
export type { PerformanceMode, RenderState };
export type { ActionHandlers, GameStateView };

let renderer: RenderManager | null = null;
let circuitBreaker: CircuitBreaker | null = null;
let resourceCache: ResourceCache | null = null;
let shaderCompiler: ShaderCompiler | null = null;
let metrics: MetricsCollector | null = null;
let sceneManager: SceneManager | null = null;
let postProcess: PostProcessManager | null = null;
let rayPicker: RayPicker | null = null;
let animCtrl: AnimationController | null = null;
let eventBus: EventBus | null = null;
let interactionResolver: InteractionResolver | null = null;

/** 初始化 3D 模块。创建 WebGL context，建立渲染基础设施。
 * @param container 父容器 DOM 元素
 * @param force 仅开发环境——跳过 Feature Flag 检查
 */
export async function init(container: HTMLElement, force = false): Promise<boolean> {
  if (!WEBGL3D_ENABLED && !force) {
    log3D.warn("AUTH_DISABLED", "WEBGL3D_ENABLED is false — refusing to init");
    return false;
  }

  try {
    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.zIndex = "0";
    container.appendChild(canvas);

    // Init RenderManager
    renderer = RenderManager.getInstance();
    const gl = renderer.createContext(canvas);

    // Init sub-modules
    circuitBreaker = new CircuitBreaker();
    resourceCache = new ResourceCache();
    shaderCompiler = new ShaderCompiler(gl);
    metrics = new MetricsCollector();
    sceneManager = new SceneManager();
    rayPicker = new RayPicker();
    animCtrl = new AnimationController();
    eventBus = new EventBus();

    // Post-process needs a shader compiler bridge
    postProcess = new PostProcessManager(gl, (vsName, fsSrc) => {
      return shaderCompiler!.compile(`builtin:${vsName}`, fsSrc, `pp_${vsName}`);
    });

    // Interaction resolver needs action handlers (wired later by host)
    interactionResolver = new InteractionResolver(eventBus, createActionHandlers());

    log3D.info("MODULE_INIT", "3D module initialized");
    return true;
  } catch (e) {
    log3D.error("MODULE_INIT_FAIL", String(e));
    return false;
  }
}

/** 销毁 3D 模块，释放所有资源。 */
export async function destroy(): Promise<void> {
  metrics?.stop();
  interactionResolver?.dispose();
  eventBus?.dispose();
  animCtrl?.dispose();
  postProcess?.dispose();
  sceneManager?.dispose();
  resourceCache?.disposeAll();
  shaderCompiler?.disposeAll();
  renderer?.destroyContext();
  circuitBreaker?.reset();

  renderer = null;
  circuitBreaker = null;
  resourceCache = null;
  shaderCompiler = null;
  metrics = null;
  sceneManager = null;
  postProcess = null;
  rayPicker = null;
  animCtrl = null;
  eventBus = null;
  interactionResolver = null;

  log3D.info("MODULE_DESTROY", "3D module destroyed");
}

/** 模块是否已初始化且活跃 */
export function isActive(): boolean {
  return renderer !== null && renderer.getState() === "active";
}

/** 获取 RenderManager 实例（仅模块内部调用） */
export function getRenderer(): RenderManager | null {
  return renderer;
}

/** 获取 CircuitBreaker 实例 */
export function getCircuitBreaker(): CircuitBreaker | null {
  return circuitBreaker;
}

/** 获取 ResourceCache 实例 */
export function getResourceCache(): ResourceCache | null {
  return resourceCache;
}

/** 获取 ShaderCompiler 实例 */
export function getShaderCompiler(): ShaderCompiler | null {
  return shaderCompiler;
}

/** 获取 MetricsCollector 实例 */
export function getMetrics(): MetricsCollector | null {
  return metrics;
}

/** 获取 SceneManager 实例 */
export function getSceneManager(): SceneManager | null {
  return sceneManager;
}

/** 获取 PostProcessManager 实例 */
export function getPostProcess(): PostProcessManager | null {
  return postProcess;
}

/** 获取 RayPicker 实例 */
export function getRayPicker(): RayPicker | null {
  return rayPicker;
}

/** 获取 AnimationController 实例 */
export function getAnimationController(): AnimationController | null {
  return animCtrl;
}

/** 获取 EventBus 实例 */
export function getEventBus(): EventBus | null {
  return eventBus;
}

/** 获取 InteractionResolver 实例 */
export function getInteractionResolver(): InteractionResolver | null {
  return interactionResolver;
}

// ─── Action handlers (bridge from 3D module to host) ─────────────────

function createActionHandlers(): ActionHandlers {
  return {
    playAnimation(target, anim) {
      animCtrl?.play(target, anim, 5 /* default duration — overridden by manifest */);
    },
    loadScene(sceneId) {
      sceneManager?.switchScene(sceneId);
    },
    showDialog(_dialogId) {
      // Delegated to UI layer via threeDStore
      // The host sets dialog.currentDialogId in threeDStore when this fires
    },
    playSound(_audioRef) {
      // Delegated to audio system
    },
    unlockQuest(_questId) {
      // Updates threeDStore.quests state
    },
    giveItem(_itemId) {
      // Updates threeDStore inventory
    },
    toggleProp(_propId) {
      // Updates threeDStore props visibility
    },
    setShaderParam(_param, _value) {
      // Updates shader uniforms via ShaderCompiler
    },
  };
}
