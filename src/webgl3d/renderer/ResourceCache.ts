/**
 * ResourceCache — GPU 资源生命周期管理（LRU 淘汰 + 泄漏检测）。
 *
 * 管理：纹理（WebGLTexture）、缓冲区（WebGLBuffer）、VAO、FBO
 *
 * Ref: [05_渲染管线 §4](docs/webgl3d-spec/05_3D场景通用渲染管线规范.md)
 * Ref: [19_性能测试 §3](docs/webgl3d-spec/19_3D渲染通用性能测试与优化标准.md)
 */

import { log3D } from "../bridge/log";
import { ErrorCodes } from "../bridge/errorCodes";

type ResourceType = "texture" | "buffer" | "vao" | "fbo" | "rbo" | "program";

interface CacheItem {
  id: string;
  type: ResourceType;
  /** Theme-scoped: cleared on hot-switch. null = common (cross-theme). */
  themeId: string | null;
  dispose: () => void;
  addedAt: number;
  lastUsedAt: number;
}

export interface ResourceCacheConfig {
  maxItems: number;
  /** Idle items (> idleMs since last use) are eligible for cleanup */
  idleMs: number;
  /** Max total items before LRU eviction kicks in */
  patrolIntervalMs: number;
}

const DEFAULT_CONFIG: ResourceCacheConfig = {
  maxItems: 5000,
  idleMs: 30_000,
  patrolIntervalMs: 30_000,
};

export class ResourceCache {
  private config: ResourceCacheConfig;
  private items = new Map<string, CacheItem>();
  private patrolTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ResourceCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startPatrol();
  }

  // ── Registration ──────────────────────────────────────────────────

  register(
    id: string,
    type: ResourceType,
    dispose: () => void,
    themeId: string | null = null,
  ): void {
    if (this.items.has(id)) {
      // Already registered — dispose old and replace
      this.items.get(id)!.dispose();
    }
    const now = Date.now();
    this.items.set(id, { id, type, themeId, dispose, addedAt: now, lastUsedAt: now });
  }

  touch(id: string): void {
    const item = this.items.get(id);
    if (item) item.lastUsedAt = Date.now();
  }

  unregister(id: string): void {
    const item = this.items.get(id);
    if (item) {
      item.dispose();
      this.items.delete(id);
    }
  }

  // ── Theme lifecycle ────────────────────────────────────────────────

  /** 释放指定主题的全部资源 */
  disposeTheme(themeId: string): void {
    const now = Date.now();
    let count = 0;
    for (const [id, item] of this.items) {
      if (item.themeId === themeId) {
        item.dispose();
        this.items.delete(id);
        count++;
      }
    }
    log3D.info("CACHE_THEME_DISPOSE", `Disposed ${count} resources for theme "${themeId}" in ${Date.now() - now}ms`);
  }

  /** 释放所有资源 */
  disposeAll(): void {
    for (const [, item] of this.items) {
      item.dispose();
    }
    this.items.clear();
    this.stopPatrol();
  }

  // ── Stats ─────────────────────────────────────────────────────────

  count(): number {
    return this.items.size;
  }

  countByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [, item] of this.items) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
  }

  // ── Leak detection & LRU cleanup ──────────────────────────────────

  private startPatrol(): void {
    this.patrolTimer = setInterval(() => this.patrol(), this.config.patrolIntervalMs);
  }

  private stopPatrol(): void {
    if (this.patrolTimer) {
      clearInterval(this.patrolTimer);
      this.patrolTimer = null;
    }
  }

  private patrol(): void {
    const now = Date.now();
    const idle: CacheItem[] = [];

    for (const [, item] of this.items) {
      if (now - item.lastUsedAt > this.config.idleMs) {
        idle.push(item);
      }
    }

    // LRU: oldest first
    idle.sort((a, b) => a.lastUsedAt - b.lastUsedAt);

    for (const item of idle) {
      item.dispose();
      this.items.delete(item.id);
    }

    if (idle.length > 0) {
      log3D.info("CACHE_PATROL", `Cleaned ${idle.length} idle resources (${this.items.size} remaining)`);
    }
  }

  /** 主题切换后检查是否有泄漏 */
  checkLeak(expectedMax: number): boolean {
    const current = this.items.size;
    if (current > expectedMax * 1.1) {
      log3D.error(ErrorCodes.MEM_LEAK_DETECTED, `Possible leak: ${current} resources vs expected ${expectedMax}`);
      return true;
    }
    return false;
  }
}
