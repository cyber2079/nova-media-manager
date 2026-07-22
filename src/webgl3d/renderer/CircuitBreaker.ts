/**
 * CircuitBreaker — 熔断器状态机。
 *
 * 状态转换：CLOSED → [连续 N 次异常] → OPEN → [冷却 T 秒] → HALF_OPEN → [1 次异常即触发] → OPEN
 * 致命异常（context_lost 3 次恢复失败、shader_compile_failed、OOM）直接 OPEN，不等待计数。
 *
 * Ref: [02_全局开发强制标准 §4](docs/webgl3d-spec/02_全局开发强制标准.md)
 */

import { log3D } from "../bridge/log";

type State = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** 连续异常阈值 */
  threshold: number;
  /** 冷却时间（ms） */
  cooldownMs: number;
  /** 异常窗口（ms） — 超过此窗口的旧异常不计入连续计数 */
  windowMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  threshold: 3,
  cooldownMs: 60_000,
  windowMs: 30_000,
};

type OpenReason = "consecutive_errors" | "context_lost_repeated" | "shader_compile_failed" | "oom";

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: State = "CLOSED";
  private errorTimestamps: number[] = [];
  private openedAt = 0;
  private reason: OpenReason = "consecutive_errors";

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): State {
    return this.state;
  }

  getReason(): OpenReason {
    return this.reason;
  }

  /** 记录一次异常。返回 true 表示熔断被触发。 */
  recordError(): boolean {
    const now = Date.now();
    this.errorTimestamps.push(now);
    // 清除超出窗口的旧异常
    this.errorTimestamps = this.errorTimestamps.filter(t => now - t <= this.config.windowMs);

    if (this.state === "CLOSED" && this.errorTimestamps.length >= this.config.threshold) {
      this.open("consecutive_errors");
      return true;
    }
    if (this.state === "HALF_OPEN") {
      this.open("consecutive_errors");
      return true;
    }
    return false;
  }

  /** 记录致命异常 — 直接熔断，不等待计数 */
  triggerFatal(reason: OpenReason): void {
    this.open(reason);
  }

  /** 尝试从 OPEN 转为 HALF_OPEN。仅在冷却期过后有效。 */
  tryHalfOpen(): boolean {
    if (this.state !== "OPEN") return false;
    if (Date.now() - this.openedAt < this.config.cooldownMs) return false;
    this.state = "HALF_OPEN";
    this.errorTimestamps = [];
    log3D.info("CIRCUIT_HALF_OPEN", `Attempting recovery after ${this.config.cooldownMs}ms cooldown`);
    return true;
  }

  /** 重置熔断器 */
  reset(): void {
    this.state = "CLOSED";
    this.errorTimestamps = [];
    this.openedAt = 0;
    log3D.info("CIRCUIT_RESET", "Circuit breaker reset to CLOSED");
  }

  /** 冷却剩余时间（ms），仅在 OPEN 状态下有效 */
  remainingCooldownMs(): number {
    if (this.state !== "OPEN") return 0;
    return Math.max(0, this.config.cooldownMs - (Date.now() - this.openedAt));
  }

  private open(reason: OpenReason): void {
    this.state = "OPEN";
    this.openedAt = Date.now();
    this.reason = reason;
    log3D.error("CIRCUIT_OPEN", `Circuit breaker OPEN — reason: ${reason}, cooldown: ${this.config.cooldownMs}ms`);
  }
}
