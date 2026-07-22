/**
 * EventBus — 交互事件分发 + Canvas 穿透判断。
 *
 * 统一入口处理鼠标/触控事件，根据 z-order 决定事件路由：
 * - React UI 面板打开 → UI 层消费
 * - 3D 可交互物体 → 交互系统消费
 * - 场景背景 → 相机操作消费
 *
 * Ref: [07_交互系统 §4, §6](docs/webgl3d-spec/07_3D交互系统通用设计标准.md)
 */

export type EventType = "click" | "hover" | "drag_start" | "drag" | "drag_end" | "proximity" | "auto" | "timer";

export interface InteractEvent {
  type: EventType;
  targetId?: string;
  position?: { x: number; y: number }; // screen coords
  pointer?: { x: number; y: number };  // normalized [0,1]
}

type Listener = (event: InteractEvent) => void;

// ─── EventBus ─────────────────────────────────────────────────────────

export class EventBus {
  private listeners = new Map<EventType, Set<Listener>>();
  private canvasBlocked = false;
  private interactionZones: { id: string; min: number[]; max: number[]; types: EventType[] }[] = [];

  // ── Event registration ──────────────────────────────────────────────

  on(type: EventType, fn: Listener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(fn);
    return () => { this.listeners.get(type)?.delete(fn); };
  }

  off(type: EventType, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }

  /** Emit an event to all listeners of that type */
  emit(event: InteractEvent): void {
    const ls = this.listeners.get(event.type);
    if (!ls) return;
    for (const fn of ls) {
      try {
        fn(event);
      } catch (e) {
        // Event handler failure must not affect other handlers
        console.warn("[Nova3D] EventBus handler error:", e);
      }
    }
  }

  // ── Canvas blocking ─────────────────────────────────────────────────

  /**
   * Block canvas events — called when React UI overlays are open.
   * While blocked, all emit() calls are silently dropped.
   */
  blockCanvas(): void {
    this.canvasBlocked = true;
  }

  unblockCanvas(): void {
    this.canvasBlocked = false;
  }

  isBlocked(): boolean {
    return this.canvasBlocked;
  }

  // ── Interaction zones ───────────────────────────────────────────────

  setInteractionZones(zones: { id: string; min: number[]; max: number[]; types: EventType[] }[]): void {
    this.interactionZones = zones;
  }

  /** Check if a screen position is within an interaction zone */
  zoneAt(x: number, y: number): string | null {
    for (const zone of this.interactionZones) {
      if (x >= zone.min[0] && x <= zone.max[0] && y >= zone.min[1] && y <= zone.max[1]) {
        return zone.id;
      }
    }
    return null;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  dispose(): void {
    this.listeners.clear();
    this.interactionZones = [];
  }
}
