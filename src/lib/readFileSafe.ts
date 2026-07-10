/**
 * Read a local file safely on Windows.
 *
 * Strips the Zone.Identifier alternate data stream (Mark of the Web) before
 * reading, which prevents SmartScreen "此文件是否来自可靠来源？" prompts
 * when the file was downloaded from the internet.
 */
export async function readFileSafe(filePath: string): Promise<Uint8Array> {
  // Unblock the file first (no-op if Zone.Identifier ADS doesn't exist)
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("unblock_file", { path: filePath });
  } catch {
    // Ignore — the command may not be registered (non-Tauri env), or file
    // permissions may prevent removing the ADS. Proceed with read anyway.
  }

  const { readFile } = await import("@tauri-apps/plugin-fs");
  return readFile(filePath);
}
