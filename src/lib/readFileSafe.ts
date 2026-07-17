/**
 * Read a local file safely on Windows.
 *
 * Strips the Zone.Identifier alternate data stream (Mark of the Web) before
 * reading, which prevents SmartScreen "此文件是否来自可靠来源？" prompts
 * when the file was downloaded from the internet.
 */
export async function readFileSafe(filePath: string): Promise<Uint8Array<ArrayBuffer>> {
  // Unblock the file first (no-op if Zone.Identifier ADS doesn't exist)
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("unblock_file", { path: filePath });
  } catch {
    // Ignore — the command may not be registered (non-Tauri env), or file
    // permissions may prevent removing the ADS. Proceed with read anyway.
  }

  const { readFile } = await import("@tauri-apps/plugin-fs");
  // plugin-fs types the result as Uint8Array<ArrayBufferLike>, but the buffer
  // is always a plain ArrayBuffer — narrow it so callers can pass it to Blob.
  return (await readFile(filePath)) as Uint8Array<ArrayBuffer>;
}
