/**
 * InteractionResolver — 交互条件评估 + 动作分发。
 *
 * 从 manifest 读取交互配置，注册到 EventBus。
 * 用户点击/拖拽/接近 → 条件评估 → 按序执行动作列表。
 *
 * Ref: [07_交互系统 §4](docs/webgl3d-spec/07_3D交互系统通用设计标准.md)
 * Ref: [11_Schema §7](docs/webgl3d-spec/11_主题元数据通用Schema标准.md)
 */

import { EventBus, type EventType } from "./EventBus";

// ─── Types (match manifest schema) ────────────────────────────────────

export type TriggerType = "click" | "hover" | "drag_end" | "proximity" | "auto" | "timer";

export type ConditionType =
  | "questCompleted"
  | "propPlaced"
  | "characterVisible"
  | "hasItem"
  | "always";

export type ActionType =
  | "playAnimation"
  | "loadScene"
  | "showDialog"
  | "playSound"
  | "unlockQuest"
  | "giveItem"
  | "toggleProp"
  | "setShaderParam";

export interface InteractionConfig {
  id: string;
  trigger: TriggerType;
  target: {
    type: "mesh";
    modelRef: string;
    meshName: string;
  };
  conditions?: {
    questCompleted?: string;
    propPlaced?: string;
    characterVisible?: string;
    hasItem?: string;
  };
  actions: InteractionAction[];
}

export interface InteractionAction {
  type: ActionType;
  target?: string;
  anim?: string;
  sceneId?: string;
  dialogId?: string;
  audioRef?: string;
  questId?: string;
  itemId?: string;
  propId?: string;
  param?: string;
  value?: unknown;
}

// ─── Game state (bridged from threeDStore at resolution time) ─────────

export interface GameStateView {
  completedQuests: Set<string>;
  placedProps: Set<string>;
  visibleCharacters: Set<string>;
  inventory: Set<string>;
}

// ─── Action handlers (injected by host) ───────────────────────────────

export interface ActionHandlers {
  playAnimation: (target: string, anim: string) => void;
  loadScene: (sceneId: string) => void;
  showDialog: (dialogId: string) => void;
  playSound: (audioRef: string) => void;
  unlockQuest: (questId: string) => void;
  giveItem: (itemId: string) => void;
  toggleProp: (propId: string) => void;
  setShaderParam: (param: string, value: unknown) => void;
}

// ─── InteractionResolver ──────────────────────────────────────────────

export class InteractionResolver {
  private bus: EventBus;
  private configs = new Map<string, InteractionConfig>();
  private handlers: ActionHandlers;
  private unsubFns: Array<() => void> = [];

  constructor(bus: EventBus, handlers: ActionHandlers) {
    this.bus = bus;
    this.handlers = handlers;
  }

  // ── Registration ────────────────────────────────────────────────────

  /** Register all interactions from manifest config */
  registerScene(configs: InteractionConfig[]): void {
    for (const config of configs) {
      this.configs.set(config.id, config);
      const unsub = this.bus.on(config.trigger, (event) => {
        // Only respond if the event matches our target
        if (event.targetId && this.matchesTarget(config, event.targetId)) {
          this.resolve(config.id, event);
        }
      });
      this.unsubFns.push(unsub);
    }
  }

  /** Unregister all interactions for a scene */
  unregisterScene(): void {
    for (const fn of this.unsubFns) fn();
    this.unsubFns = [];
    this.configs.clear();
  }

  // ── Resolution ──────────────────────────────────────────────────────

  /** Manually resolve an interaction (by ID, for auto/timer triggers) */
  resolve(interactionId: string, _event: { targetId?: string }, state?: GameStateView): boolean {
    const config = this.configs.get(interactionId);
    if (!config) return false;

    // Evaluate conditions
    if (!this.evaluateConditions(config, state)) return false;

    // Execute actions in order
    for (const action of config.actions) {
      try {
        this.executeAction(action);
      } catch (e) {
        console.warn(`[Nova3D] Interaction action failed: ${interactionId}/${action.type}`, e);
        // Continue with remaining actions
      }
    }

    return true;
  }

  // ── Condition evaluation ────────────────────────────────────────────

  private evaluateConditions(config: InteractionConfig, state?: GameStateView): boolean {
    if (!config.conditions) return true; // no conditions = always true

    const c = config.conditions;
    const s = state;

    if (c.questCompleted) {
      if (!s?.completedQuests.has(c.questCompleted)) return false;
    }
    if (c.propPlaced) {
      if (!s?.placedProps.has(c.propPlaced)) return false;
    }
    if (c.characterVisible) {
      if (!s?.visibleCharacters.has(c.characterVisible)) return false;
    }
    if (c.hasItem) {
      if (!s?.inventory.has(c.hasItem)) return false;
    }

    return true;
  }

  // ── Action dispatch ─────────────────────────────────────────────────

  private executeAction(action: InteractionAction): void {
    switch (action.type) {
      case "playAnimation":
        if (action.target && action.anim) {
          this.handlers.playAnimation(action.target, action.anim);
        }
        break;
      case "loadScene":
        if (action.sceneId) {
          this.handlers.loadScene(action.sceneId);
        }
        break;
      case "showDialog":
        if (action.dialogId) {
          this.handlers.showDialog(action.dialogId);
        }
        break;
      case "playSound":
        if (action.audioRef) {
          this.handlers.playSound(action.audioRef);
        }
        break;
      case "unlockQuest":
        if (action.questId) {
          this.handlers.unlockQuest(action.questId);
        }
        break;
      case "giveItem":
        if (action.itemId) {
          this.handlers.giveItem(action.itemId);
        }
        break;
      case "toggleProp":
        if (action.propId) {
          this.handlers.toggleProp(action.propId);
        }
        break;
      case "setShaderParam":
        if (action.param && action.value !== undefined) {
          this.handlers.setShaderParam(action.param, action.value);
        }
        break;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private matchesTarget(config: InteractionConfig, hitObjectId: string): boolean {
    const t = config.target;
    // hitObjectId from RayPicker is "modelRef:meshName" or just the interactionId
    return hitObjectId === config.id ||
      hitObjectId === `${t.modelRef}:${t.meshName}` ||
      hitObjectId === t.meshName;
  }

  dispose(): void {
    this.unregisterScene();
  }
}
