// ── 媒体导入编排：自动识别文件/文件夹 ──
// Rust expand_media_paths 纯只读：文件按扩展名收、文件夹递归扫、与库去重；
// 这里把结果分发给各库现有 add 管线（封面/元数据/事件全复用）。

import { useMovieStore } from "@/stores/movieStore";
import { useMusicStore } from "@/stores/musicStore";
import { useImageStore } from "@/stores/imageStore";

export type MediaKind = "movies" | "music" | "images";

export interface ImportSummary {
  added: number;
  truncated: boolean; // 命中单次 2000 上限被截断，可再扫一次
}

const adders: Record<MediaKind, (paths: string[]) => Promise<void>> = {
  movies: (p) => useMovieStore.getState().addMovies(p),
  music: (p) => useMusicStore.getState().addMusic(p),
  images: (p) => useImageStore.getState().addImages(p),
};

/** 任意路径（文件/文件夹混合）导入指定库 — Rust 侧自动识别 + 递归 + 去重 */
export async function importMediaPaths(paths: string[], kind: MediaKind): Promise<ImportSummary> {
  if (paths.length === 0) return { added: 0, truncated: false };
  const { invoke } = await import("@tauri-apps/api/core");
  const res = await invoke<{ files: string[]; truncated: boolean }>("expand_media_paths", { paths, kind });
  if (res.files.length) await adders[kind](res.files);
  return { added: res.files.length, truncated: res.truncated };
}

/** 文件夹选择器 → 导入。用户取消返回 null。 */
export async function pickFolderAndImport(kind: MediaKind): Promise<ImportSummary | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const sel = await open({ directory: true, multiple: false });
  if (typeof sel !== "string") return null;
  return importMediaPaths([sel], kind);
}

/** 导入结果的 toast 文案 */
export function importSummaryText(r: ImportSummary, unit: string, t: (key: string, vars?: Record<string, any>) => string): string {
  if (r.added === 0) return t("mediaScan.no_new_media");
  const base = t("mediaScan.imported_n", { n: r.added, unit });
  return r.truncated ? base + t("mediaScan.truncated") : base;
}
