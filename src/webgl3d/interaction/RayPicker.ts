/**
 * RayPicker — 射线拾取（AABB 粗筛 + 三角面精确求交）。
 *
 * Ref: [07_交互系统 §2](docs/webgl3d-spec/07_3D交互系统通用设计标准.md)
 */

import { vec3, mat4 } from "gl-matrix";

export interface Ray {
  origin: vec3;
  direction: vec3;
}

export interface HitResult {
  distance: number;
  point: vec3;
  objectId: string;
  meshName?: string;
  normal?: vec3;
}

export interface BoundingBox {
  min: vec3;
  max: vec3;
}

export interface PickableObject {
  id: string;
  meshName: string;
  aabb: BoundingBox;
  /** Vertices (positions, interleaved xyz) for triangle-level ray test */
  vertices?: Float32Array;
  indices?: Uint16Array;
  worldMatrix: mat4;
  interactable: boolean;
  interactionId?: string;
  highlightOnHover?: boolean;
  highlightColor?: [number, number, number];
}

// ─── RayPicker ────────────────────────────────────────────────────────

export class RayPicker {
  private objects = new Map<string, PickableObject[]>();

  /** Register pickable objects for a scene */
  registerScene(sceneId: string, objects: PickableObject[]): void {
    this.objects.set(sceneId, objects);
  }

  unregisterScene(sceneId: string): void {
    this.objects.delete(sceneId);
  }

  /**
   * Cast a ray and return sorted hit results (closest first).
   * @param ray World-space ray
   * @param sceneId Current scene
   * @param filterInteractableOnly If true, only return interactable objects
   */
  cast(ray: Ray, sceneId: string, filterInteractableOnly = true): HitResult[] {
    const sceneObjects = this.objects.get(sceneId);
    if (!sceneObjects) return [];

    const hits: HitResult[] = [];
    const objs = filterInteractableOnly
      ? sceneObjects.filter(o => o.interactable)
      : sceneObjects;

    for (const obj of objs) {
      // 1. AABB coarse test
      const aabbHit = this.rayAABB(ray, obj.aabb, obj.worldMatrix);
      if (aabbHit === null) continue;

      // 2. Triangle-level precise test (if vertex data available)
      let closestDist = aabbHit;
      let closestNormal: vec3 | undefined;

      if (obj.vertices && obj.indices) {
        const triHit = this.rayTriangles(ray, obj.vertices, obj.indices, obj.worldMatrix);
        if (triHit) {
          closestDist = triHit.distance;
          closestNormal = triHit.normal;
        } else {
          continue; // AABB hit but no triangle hit — skip
        }
      }

      const point = vec3.scaleAndAdd(vec3.create(), ray.origin, ray.direction, closestDist);
      hits.push({
        distance: closestDist,
        point,
        objectId: obj.id,
        meshName: obj.meshName,
        normal: closestNormal,
      });
    }

    // Sort by distance
    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  /** Get highlight data for the top hit */
  getHighlight(hit: HitResult, sceneId: string): PickableObject | null {
    const sceneObjects = this.objects.get(sceneId);
    if (!sceneObjects) return null;
    return sceneObjects.find(o => o.id === hit.objectId && o.highlightOnHover) ?? null;
  }

  // ── Ray generation ──────────────────────────────────────────────────

  /** Generate world-space ray from screen coordinates + inverse VP matrix */
  static screenToRay(
    screenX: number, screenY: number,
    canvasWidth: number, canvasHeight: number,
    invViewProj: mat4
  ): Ray {
    const ndcX = (screenX / canvasWidth) * 2 - 1;
    const ndcY = -(screenY / canvasHeight) * 2 + 1;

    const near = vec3.transformMat4(vec3.create(), vec3.fromValues(ndcX, ndcY, -1), invViewProj);
    const far = vec3.transformMat4(vec3.create(), vec3.fromValues(ndcX, ndcY, 1), invViewProj);
    const dir = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), far, near));

    return { origin: near, direction: dir };
  }

  // ── Intersection math ───────────────────────────────────────────────

  /** Ray vs AABB (transformed by world matrix). Returns tMin or null. */
  private rayAABB(ray: Ray, aabb: BoundingBox, worldMat: mat4): number | null {
    const inv = mat4.invert(mat4.create(), worldMat)!;
    const localOrigin = vec3.transformMat4(vec3.create(), ray.origin, inv);
    const localDir = vec3.transformMat4(vec3.create(), ray.direction, mat4.invert(mat4.create(), mat4.transpose(mat4.create(), worldMat))!);
    vec3.normalize(localDir, localDir);

    let tMin = -Infinity, tMax = Infinity;
    for (let i = 0; i < 3; i++) {
      const o = localOrigin[i], d = localDir[i];
      const lo = aabb.min[i], hi = aabb.max[i];
      if (Math.abs(d) < 1e-8) {
        if (o < lo || o > hi) return null;
      } else {
        let t0 = (lo - o) / d, t1 = (hi - o) / d;
        if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
        tMin = Math.max(tMin, t0);
        tMax = Math.min(tMax, t1);
        if (tMin > tMax) return null;
      }
    }
    return tMin >= 0 ? tMin : tMax >= 0 ? tMax : null;
  }

  /** Ray vs triangle mesh. Returns closest hit distance + normal. */
  private rayTriangles(
    ray: Ray, vertices: Float32Array, indices: Uint16Array, worldMat: mat4
  ): { distance: number; normal: vec3 } | null {
    let closest = Infinity;
    let closestNormal: vec3 | null = null;

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3, i1 = indices[i + 1] * 3, i2 = indices[i + 2] * 3;
      const v0 = vec3.transformMat4(vec3.create(),
        vec3.fromValues(vertices[i0], vertices[i0 + 1], vertices[i0 + 2]), worldMat);
      const v1 = vec3.transformMat4(vec3.create(),
        vec3.fromValues(vertices[i1], vertices[i1 + 1], vertices[i1 + 2]), worldMat);
      const v2 = vec3.transformMat4(vec3.create(),
        vec3.fromValues(vertices[i2], vertices[i2 + 1], vertices[i2 + 2]), worldMat);

      const e1 = vec3.sub(vec3.create(), v1, v0);
      const e2 = vec3.sub(vec3.create(), v2, v0);
      const h = vec3.cross(vec3.create(), ray.direction, e2);
      const a = vec3.dot(e1, h);

      if (Math.abs(a) < 1e-8) continue; // parallel

      const f = 1 / a;
      const s = vec3.sub(vec3.create(), ray.origin, v0);
      const u = f * vec3.dot(s, h);
      if (u < 0 || u > 1) continue;

      const q = vec3.cross(vec3.create(), s, e1);
      const v = f * vec3.dot(ray.direction, q);
      if (v < 0 || u + v > 1) continue;

      const t = f * vec3.dot(e2, q);
      if (t > 1e-8 && t < closest) {
        closest = t;
        closestNormal = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), e1, e2));
      }
    }

    if (closestNormal === null) return null;
    return { distance: closest, normal: closestNormal };
  }
}
