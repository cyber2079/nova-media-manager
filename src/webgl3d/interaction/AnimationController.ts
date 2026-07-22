/**
 * AnimationController — 动画状态机。
 *
 * 功能：
 * - 状态注册与切换（idle / greet / walk / interact_01 / ...）
 * - 循环/非循环动画 + nextAnim 自动过渡
 * - interruptible 打断策略
 * - 多角色独立状态机
 * - 过渡 blend time
 *
 * Ref: [07_交互系统 §3](docs/webgl3d-spec/07_3D交互系统通用设计标准.md)
 */

export interface AnimationDef {
  /** Key in resources.animations */
  animRef: string;
  /** Loop until interrupted */
  loop: boolean;
  /** Next state after non-loop animation finishes */
  nextAnim?: string;
  /** Can be interrupted by new triggers */
  interruptible?: boolean;
  /** Blend time in seconds */
  transitionTime?: number;
}

export interface AnimationState {
  id: string;
  def: AnimationDef;
  startedAt: number;   // performance.now()
  elapsed: number;     // seconds played so far (accounting for pause)
  duration: number;    // total animation duration in seconds
  weight: number;      // 0-1 blend weight (for transition blending)
}

export type TriggerAction =
  | "greet"
  | "walk"
  | "interact_01"
  | "interact_02"
  | "bow"
  | string;

// ─── AnimationController ──────────────────────────────────────────────

export class AnimationController {
  private characters = new Map<string, {
    states: Map<string, AnimationDef>;
    current: AnimationState | null;
    previous: AnimationState | null; // fading out during transition
    isPlaying: boolean;
    pausedAt: number | null;
  }>();

  // ── Registration ────────────────────────────────────────────────────

  registerCharacter(charId: string, animations: Record<string, AnimationDef>): void {
    const states = new Map(Object.entries(animations));
    this.characters.set(charId, {
      states,
      current: null,
      previous: null,
      isPlaying: false,
      pausedAt: null,
    });
  }

  unregisterCharacter(charId: string): void {
    this.characters.delete(charId);
  }

  // ── Playback control ────────────────────────────────────────────────

  /** Start playing a specific animation state */
  play(charId: string, animId: string, duration: number): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;

    const def = char.states.get(animId);
    if (!def) return false;

    // Check interruptibility
    if (char.current && char.current.def.interruptible === false && char.isPlaying) {
      return false; // current animation is not interruptible
    }

    // Transition: old state fades out
    if (char.current && def.transitionTime && def.transitionTime > 0) {
      char.previous = { ...char.current, weight: 1 };
    } else {
      char.previous = null;
    }

    char.current = {
      id: animId,
      def,
      startedAt: performance.now(),
      elapsed: 0,
      duration,
      weight: 0, // fade in
    };
    char.isPlaying = true;
    char.pausedAt = null;
    return true;
  }

  /** Update all characters (call each frame with dt in seconds) */
  tick(dt: number): void {
    for (const [charId, char] of this.characters) {
      if (!char.isPlaying || char.pausedAt !== null) continue;
      if (!char.current) continue;

      char.current.elapsed += dt;

      // Blend weights
      const transTime = char.current.def.transitionTime ?? 0.1;
      char.current.weight = Math.min(1, char.current.elapsed / transTime);
      if (char.previous) {
        char.previous.weight = Math.max(0, 1 - char.current.elapsed / transTime);
        if (char.previous.weight <= 0) char.previous = null;
      }

      // Auto-advance on non-looping animation end
      if (!char.current.def.loop && char.current.elapsed >= char.current.duration) {
        const nextAnimId = char.current.def.nextAnim;
        if (nextAnimId && char.states.has(nextAnimId)) {
          // Play next state (with same duration as placeholder — real duration set by caller)
          this.play(charId, nextAnimId, char.current.duration);
        } else {
          char.isPlaying = false;
        }
      }
    }
  }

  pause(charId: string): void {
    const char = this.characters.get(charId);
    if (char) char.pausedAt = performance.now();
  }

  resume(charId: string): void {
    const char = this.characters.get(charId);
    if (char && char.pausedAt !== null) {
      char.pausedAt = null;
    }
  }

  // ── Query ────────────────────────────────────────────────────────────

  getCurrentAnimId(charId: string): string | null {
    return this.characters.get(charId)?.current?.id ?? null;
  }

  getCurrentState(charId: string): AnimationState | null {
    return this.characters.get(charId)?.current ?? null;
  }

  isPlaying(charId: string): boolean {
    return this.characters.get(charId)?.isPlaying ?? false;
  }

  /** Get all active animation states for rendering (current + fading previous) */
  getActiveStates(charId: string): AnimationState[] {
    const char = this.characters.get(charId);
    if (!char) return [];
    const states: AnimationState[] = [];
    if (char.current) states.push(char.current);
    if (char.previous) states.push(char.previous);
    return states;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  dispose(): void {
    this.characters.clear();
  }
}
