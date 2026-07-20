// Shared Tauri invoke wrapper — use instead of copy-pasting
// the dynamic import in every store.
//
// Default behavior: swallows errors and returns null (safe for most store operations).
// Pass { raw: true } in args to get raw error propagation when needed.

let _invokeFn: ((cmd: string, args?: Record<string, unknown>) => Promise<any>) | null = null;

async function getInvoke() {
  if (_invokeFn) return _invokeFn;
  const mod = await import("@tauri-apps/api/core");
  _invokeFn = mod.invoke;
  return _invokeFn;
}

export async function invoke(cmd: string, args?: Record<string, unknown> & { raw?: boolean }): Promise<any> {
  try {
    const fn = await getInvoke();
    // Strip internal `raw` flag before passing to Rust
    const { raw: _, ...rest } = args ?? ({} as any);
    return await fn(cmd, rest);
  } catch {
    if (args?.raw) throw new Error(`Tauri invoke failed: ${cmd}`);
    return null;
  }
}
