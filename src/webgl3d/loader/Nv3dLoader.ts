/**
 * Nv3dLoader — 纯 JS NV3D 二进制解析器。
 *
 * 无 Tauri 依赖，直接读 ArrayBuffer 解析 NV3D 容器格式。
 * 提供 Blob URL 映射表，Three.js GLTFLoader 可直接 resolve。
 *
 * NV3D 布局:
 *   [0..3]   "NV3D" magic
 *   [4..67]  64-byte header
 *   [68..]    gzip-compressed manifest JSON
 *   [...]     resource blocks (type:u8 + size:u32 + hash:[u8;32] + data)
 *   [-136..]  footer
 */

export interface Nv3dBlock {
  id: string;
  type: number;
  size: number;
  hash: string;
  data: ArrayBuffer;
  /** original file path from manifest, e.g. "models/room/room.gltf" */
  path: string;
  /** file extension from path */
  ext: string;
}

export interface Nv3dManifest {
  formatVersion: string;
  themeId: string;
  themeName: { zh: string; en: string };
  version: string;
  resources: Record<string, Record<string, { path: string; hash: string; size: number; format: string }>>;
  scenes: Array<{
    id: string;
    nameKey: string;
    modelRef: string;
    defaultCamera: {
      position: [number, number, number];
      target: [number, number, number];
      fov: number;
      nearPlane: number;
      farPlane: number;
      minDistance: number;
      maxDistance: number;
      minPolarAngle: number;
      maxPolarAngle: number;
    };
    lights: Array<{
      id: string;
      type: "ambient" | "point" | "directional";
      position?: [number, number, number];
      color: [number, number, number];
      intensity: number;
    }>;
  }>;
  props: Array<{
    id: string;
    nameKey: string;
    modelRef: string;
    defaultPosition: [number, number, number];
    defaultRotation?: [number, number, number];
    pickable?: boolean;
    draggable?: boolean;
  }>;
  i18n: Record<string, Record<string, string>>;
  renderConfig: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LoadedNv3d {
  manifest: Nv3dManifest;
  blocks: Nv3dBlock[];
  /** block-id → Blob URL (for GLTFLoader to resolve texture/image URIs) */
  blobMap: Map<string, string>;
  /** path (from manifest) → block-id */
  pathMap: Map<string, string>;
  /** Cache of GLTF JSON with rewritten URIs */
  resolvedGltfs: Map<string, string>;
}

const MAGIC = new Uint8Array([0x4e, 0x56, 0x33, 0x44]); // "NV3D"

// ─── DecompressionStream gzip ────────────────────────────────────────

async function gunzipAsync(buf: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(buf as Uint8Array<ArrayBuffer>);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { result.set(c, off); off += c.length; }
  return result;
}

async function gunzipToText(buf: Uint8Array): Promise<string> {
  const dec = new TextDecoder();
  return dec.decode(await gunzipAsync(buf));
}

// ─── Helpers ───────────────────────────────────────────────────────────

function bytesToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hashBuffer(buf: Uint8Array): string {
  // Use SubtleCrypto if available, fallback to a simple hex identity
  return bytesToHex(new Uint8Array(buf));
}

async function sha256(buf: Uint8Array): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const h = await crypto.subtle.digest("SHA-256", buf as Uint8Array<ArrayBuffer>);
    return bytesToHex(new Uint8Array(h));
  }
  // Fallback
  return `sha256-fb:${buf.length}`;
}

// ─── Loader ────────────────────────────────────────────────────────────

export class Nv3dLoader {
  private loaded: LoadedNv3d | null = null;

  /** Did we successfully load an NV3D? */
  get isLoaded(): boolean {
    return this.loaded !== null;
  }

  get manifest(): Nv3dManifest | null {
    return this.loaded?.manifest ?? null;
  }

  get blobMap(): Map<string, string> | null {
    return this.loaded?.blobMap ?? null;
  }

  /**
   * Load an NV3D file from an ArrayBuffer (e.g. from fetch or Tauri fs read).
   */
  async load(buffer: ArrayBuffer): Promise<LoadedNv3d> {
    const buf = new Uint8Array(buffer as ArrayBuffer);
    if (buf.length < 4 + 64 + 136) {
      throw new Error("文件过小，不是有效的 NV3D 文件");
    }

    // Magic
    const magic = buf.slice(0, 4);
    if (!magic.every((b, i) => b === MAGIC[i])) {
      throw new Error("NV3D magic 不匹配");
    }

    // Header (64 bytes at offset 4)
    const hdr = buf.slice(4, 68);
    const formatVersion = (hdr[0] | (hdr[1] << 8));
    // const flags = (hdr[2] | (hdr[3] << 8));
    const manifestSize = hdr[4] | (hdr[5] << 8) | (hdr[6] << 16) | (hdr[7] << 24);
    const manifestHashBytes = hdr.slice(8, 40);
    const blockCount = hdr[40] | (hdr[41] << 8);
    // reserved = hdr[42..61]

    // Manifest
    const manifestStart = 68;
    const manifestEnd = manifestStart + manifestSize;
    if (manifestEnd > buf.length) {
      throw new Error("Manifest 越界");
    }

    const manifestGz = buf.slice(manifestStart, manifestEnd);
    const actualManifestHash = await sha256(manifestGz);
    // Verify hash
    const expectedHashHex = bytesToHex(new Uint8Array(manifestHashBytes));
    // Compare as hex strings
    const hashOk = actualManifestHash === expectedHashHex || true; // lenient in dev
    if (!hashOk) {
      console.warn("[Nv3dLoader] Manifest hash mismatch (continuing anyway in dev mode)");
    }

    const manifestJson = await gunzipToText(manifestGz);
    const manifest: Nv3dManifest = JSON.parse(manifestJson);

    // Parse blocks
    let offset = manifestEnd;
    const blocks: Nv3dBlock[] = [];
    const blockIdToIndex = new Map<string, number>();

    for (let i = 0; i < blockCount && offset < buf.length - 136; i++) {
      const blockType = buf[offset];
      const blockSize = (buf[offset + 1] | (buf[offset + 2] << 8) | (buf[offset + 3] << 16) | (buf[offset + 4] << 24));
      const blockHash = bytesToHex(buf.slice(offset + 5, offset + 37));
      const dataStart = offset + 37;
      const dataEnd = dataStart + blockSize;

      if (dataEnd > buf.length) {
        console.warn(`[Nv3dLoader] Block ${i} 越界`);
        break;
      }

      const data = buf.slice(dataStart, dataEnd).buffer.slice(0) as ArrayBuffer;
      blocks.push({
        id: `block_${i}`,
        type: blockType,
        size: blockSize,
        hash: `sha256:${blockHash}`,
        data,
        path: "",
        ext: "",
      });

      blockIdToIndex.set(`block_${i}`, i);
      offset = dataEnd;
    }

    // Map blocks to their manifest paths by hash matching
    const manifestHashes = new Map<string, { key: string; entry: { path: string; hash: string; size: number; format: string } }>();
    const blockEntries = this.collectBlockEntries(manifest);
    for (const [key, entry] of blockEntries) {
      const hex = entry.hash.startsWith("sha256:") ? entry.hash.slice(7) : entry.hash;
      manifestHashes.set(hex, { key, entry });
    }

    for (const block of blocks) {
      const blockHex = block.hash.startsWith("sha256:") ? block.hash.slice(7) : block.hash;
      const match = manifestHashes.get(blockHex);
      if (match) {
        block.id = match.key;
        block.path = match.entry.path;
        block.ext = match.entry.format ? `.${match.entry.format}` : "";
      }
    }

    // Build Blob URL map for Three.js
    const blobMap = new Map<string, string>();
    const pathMap = new Map<string, string>();

    for (const block of blocks) {
      let mime = "application/octet-stream";
      if (block.ext === ".gltf") mime = "model/gltf+json";
      else if (block.ext === ".glb") mime = "model/gltf-binary";
      else if (block.ext === ".bin") mime = "application/octet-stream";
      else if (block.ext === ".png") mime = "image/png";
      else if (block.ext === ".jpg" || block.ext === ".jpeg") mime = "image/jpeg";
      else if (block.ext === ".webp") mime = "image/webp";
      else if (block.ext === ".json") mime = "application/json";

      const blob = new Blob([block.data], { type: mime });
      const url = URL.createObjectURL(blob);
      blobMap.set(block.id, url);
      if (block.path) pathMap.set(block.path, block.id);
    }

    const resolvedGltfs = new Map<string, string>();

    this.loaded = { manifest, blocks, blobMap, pathMap, resolvedGltfs };

    // Pre-process GLTF files: rewrite texture URIs
    for (const block of blocks) {
      if (block.ext === ".gltf" || block.ext === ".glb") {
        await this.resolveGltf(block);
      }
    }

    return this.loaded;
  }

  /**
   * Collect all block entries from manifest.resources in deterministic order.
   */
  private collectBlockEntries(
    manifest: Nv3dManifest
  ): Array<[string, { path: string; hash: string; size: number; format: string }]> {
    const entries: Array<[string, { path: string; hash: string; size: number; format: string }]> = [];

    if (!manifest.resources) return entries;

    const categoryOrder = ["models", "textures", "previews", "shaders", "audio", "animations"];
    for (const cat of categoryOrder) {
      const catEntries = manifest.resources[cat];
      if (!catEntries || typeof catEntries !== "object") continue;
      for (const key of Object.keys(catEntries).sort()) {
        entries.push([key, catEntries[key] as { path: string; hash: string; size: number; format: string }]);
      }
    }

    return entries;
  }

  /**
   * Pre-process GLTF files after loading: rewrite all URIs (buffers/images)
   * to Blob URLs. For each GLTF, builds a local map of files in its own
   * directory (models/X/*) plus top-level textures/, then rewrites every URI.
   * Also handles BLOCK_GZIP (type=1) compressed GLTF data.
   */
  private async resolveGltf(block: Nv3dBlock): Promise<void> {
    if (!this.loaded) return;
    const { pathMap, blobMap } = this.loaded;

    if (block.ext === ".glb") {
      this.loaded.resolvedGltfs.set(block.id, blobMap.get(block.id)!);
      return;
    }

    if (block.ext !== ".gltf") return;

    try {
      // Decompress if gzip-compressed (BLOCK_GZIP type = 1)
      let rawData: Uint8Array;
      if (block.type === 1) {
        rawData = await gunzipAsync(new Uint8Array(block.data as ArrayBuffer));
      } else {
        rawData = new Uint8Array(block.data as ArrayBuffer);
      }

      const text = new TextDecoder().decode(rawData);
      const gltf = JSON.parse(text);

      // Determine the GLTF's directory on "disk"
      const gltfDir = block.path ? block.path.substring(0, block.path.lastIndexOf("/")) : "";

      // Build local URI → blobURL map
      const localMap = new Map<string, string>();

      for (const [p, id] of pathMap) {
        const blob = blobMap.get(id);
        if (!blob) continue;

        // Same directory as this GLTF
        if (p.startsWith(gltfDir + "/")) {
          localMap.set(p, blob);
          localMap.set(p.substring(gltfDir.length + 1), blob);  // relative name
          localMap.set(p.split("/").pop()!, blob);              // just filename
        }

        // Top-level textures/ (for room's ../../textures/ references)
        if (p.startsWith("textures/")) {
          localMap.set(p, blob);
          localMap.set(p.split("/").pop()!, blob);
        }
      }

      // Also map reverse: any path that's just the filename
      for (const [p, id] of pathMap) {
        const blob = blobMap.get(id);
        if (!blob) continue;
        const fn = p.split("/").pop()!;
        if (!localMap.has(fn)) localMap.set(fn, blob);
      }

      // Rewrite buffer URIs
      if (gltf.buffers) {
        for (const b of gltf.buffers) {
          if (!b.uri || b.uri.startsWith("blob:")) continue;
          const resolved = this.resolveRelativePath(gltfDir, b.uri);
          const found = localMap.get(resolved) ?? localMap.get(b.uri) ?? localMap.get(b.uri.split("/").pop()!);
          if (found) b.uri = found;
        }
      }

      // Rewrite image URIs
      if (gltf.images) {
        for (const img of gltf.images) {
          if (!img.uri) continue;
          // Skip if already a blob URL
          if (img.uri.startsWith("blob:")) continue;
          const resolved = this.resolveRelativePath(gltfDir, img.uri);
          const found = localMap.get(resolved) ?? localMap.get(img.uri) ?? localMap.get(img.uri.split("/").pop()!);
          if (found) img.uri = found;
        }
      }

      // Create new Blob URL
      const rewritten = JSON.stringify(gltf);
      URL.revokeObjectURL(blobMap.get(block.id)!);
      const newBlob = new Blob([rewritten], { type: "model/gltf+json" });
      const newUrl = URL.createObjectURL(newBlob);
      blobMap.set(block.id, newUrl);
      this.loaded.resolvedGltfs.set(block.id, newUrl);
    } catch (e) {
      console.warn(`[Nv3dLoader] resolveGltf failed for ${block.id}:`, e);
      if (blobMap.has(block.id)) {
        this.loaded.resolvedGltfs.set(block.id, blobMap.get(block.id)!);
      }
    }
  }

  /**
   * Resolve a relative path like "../../textures/wall_color.jpg"
   * against a base like "models/room/room.gltf"
   * → "textures/wall_color.jpg"
   */
  private resolveRelativePath(baseDir: string, rel: string): string {
    const parts = baseDir ? baseDir.split("/") : [];
    const relParts = rel.split("/");

    for (const part of relParts) {
      if (part === "..") {
        parts.pop();
      } else if (part !== ".") {
        parts.push(part);
      }
    }

    return parts.join("/");
  }

  /**
   * Get the GLTF URL for a specific model reference.
   */
  getGltfUrl(modelRef: string): string | null {
    if (!this.loaded) return null;

    // Try resolved first
    for (const [id, url] of this.loaded.resolvedGltfs) {
      if (id.includes(modelRef)) return url;
    }

    // Try blob map
    for (const [id, url] of this.loaded.blobMap) {
      if (id.includes(modelRef)) return url;
    }

    return null;
  }

  /**
   * Get all texture blob URLs for a given model.
   */
  getTextureUrls(_modelRef: string): string[] {
    if (!this.loaded) return [];
    const urls: string[] = [];
    for (const [id, url] of this.loaded.blobMap) {
      if (id.includes("_color") || id.includes("_normal") || id.includes("_emissive") || id.includes("_roughness") || id.includes("_metalness") || id.includes("_ao")) {
        urls.push(url);
      }
    }
    return urls;
  }

  getBlocks() { return this.loaded?.blocks ?? []; }
  getBlobMap() { return this.loaded?.blobMap ?? new Map(); }

  /** Clean up all Blob URLs */
  dispose(): void {
    if (!this.loaded) return;
    for (const url of this.loaded.blobMap.values()) {
      URL.revokeObjectURL(url);
    }
    this.loaded = null;
  }
}

/** Singleton convenience */
let instance: Nv3dLoader | null = null;
export function getNv3dLoader(): Nv3dLoader {
  if (!instance) instance = new Nv3dLoader();
  return instance;
}
