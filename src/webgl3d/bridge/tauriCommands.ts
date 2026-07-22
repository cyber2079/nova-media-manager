/**
 * 3D 模块 → Rust 侧 Tauri command 封装。
 *
 * 所有 invoke 调用 try-catch，失败返回 null，不抛异常。
 * 参数名使用 snake_case（Rust 侧约定）。
 *
 * Ref: [15_底层调用接口](docs/webgl3d-spec/15_3D资源底层调用接口文档.md)
 */

const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> => {
  try {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return await tauriInvoke<T>(cmd, args);
  } catch (e) {
    console.error(`[Nova3D] tauri invoke failed: ${cmd}`, e);
    return null;
  }
};

export interface Nv3dManifest {
  formatVersion: string;
  themeId: string;
  version: string;
  resources: Record<string, unknown>;
  scenes: unknown[];
  i18n: Record<string, Record<string, string>>;
  renderConfig: Record<string, unknown>;
  [key: string]: unknown;
}

/** 打开 NV3D 文件，返回 Manifest */
export async function openNv3d(path: string): Promise<Nv3dManifest | null> {
  const result = await invoke<{ success: boolean; manifest?: string; formatVersion?: string; error?: string }>(
    "nv3d_open", { path }
  );
  if (!result?.success || !result.manifest) return null;
  try { return JSON.parse(result.manifest) as Nv3dManifest; } catch { return null; }
}

/** 校验 NV3D 签名 */
export async function verifyNv3d(path: string): Promise<boolean> {
  const result = await invoke<{ valid: boolean }>("nv3d_verify", { path });
  return result?.valid ?? false;
}

/** 读取 Resource Block */
export async function readBlock(path: string, blockId: string, expectedHash: string): Promise<ArrayBuffer | null> {
  const result = await invoke<{ success: boolean; data?: number[]; hashMatch?: boolean; error?: string }>(
    "nv3d_read_block", { path, block_id: blockId, expected_hash: expectedHash }
  );
  if (!result?.success || !result.data || !result.hashMatch) return null;
  return new Uint8Array(result.data).buffer;
}

/** 保存用户存档 */
export async function saveData(themeId: string, slot: number, data: string): Promise<boolean> {
  const result = await invoke<{ success: boolean }>(
    "webgl3d_save_data", { theme_id: themeId, slot, data }
  );
  return result?.success ?? false;
}

/** 读取用户存档 */
export async function loadData(themeId: string, slot: number): Promise<string | null> {
  const result = await invoke<{ success: boolean; data?: string; exists?: boolean }>(
    "webgl3d_load_data", { theme_id: themeId, slot }
  );
  if (!result?.success || !result.exists) return null;
  return result.data ?? null;
}

/** 删除存档 */
export async function deleteData(themeId: string, slot?: number): Promise<number> {
  const result = await invoke<{ success: boolean; deletedCount: number }>(
    "webgl3d_delete_data", slot !== undefined ? { theme_id: themeId, slot } : { theme_id: themeId }
  );
  return result?.deletedCount ?? 0;
}

/** 查询缓存大小 */
export async function cacheSize(themeId?: string): Promise<{ sizeBytes: number; themeCount: number } | null> {
  return invoke("webgl3d_cache_size", themeId ? { theme_id: themeId } : {});
}

/** 清理缓存 */
export async function clearCache(themeId?: string): Promise<number> {
  const result = await invoke<{ success: boolean; freedBytes: number }>(
    "webgl3d_clear_cache", themeId ? { theme_id: themeId } : {}
  );
  return result?.freedBytes ?? 0;
}
