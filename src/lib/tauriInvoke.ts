// Shared Tauri invoke wrapper — use instead of copy-pasting
// the dynamic import in every store.

let _invokeFn: ((cmd: string, args?: Record<string, unknown>) => Promise<any>) | null = null;

async function getInvoke() {
  if (_invokeFn) return _invokeFn;
  const mod = await import("@tauri-apps/api/core");
  _invokeFn = mod.invoke;
  return _invokeFn;
}

export async function invoke(cmd: string, args?: Record<string, unknown>): Promise<any> {
  try {
    const fn = await getInvoke();
    return await fn(cmd, args);
  } catch {
    return null;
  }
}
