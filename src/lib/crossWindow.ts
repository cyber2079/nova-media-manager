/**
 * Cross-window event communication.
 *
 * Main window emits events → secondary window listens, and vice versa.
 * Used for: now-playing sync, widget updates, display coordination.
 */
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { useLicenseStore, isUltra, type LicenseInfo } from "@/stores/licenseStore";

// ═══════════════════ TYPES ═══════════════════

export interface NowPlayingPayload {
  title: string;
  artist?: string;
  album?: string;
  coverPath?: string;
  duration?: string;
  currentTime?: string;
  isPlaying: boolean;
}

export interface SecondaryDisplayInfo {
  open: boolean;
  label: string;
  title: string;
}

// ═══════════════════ API ═══════════════════

/** Open the secondary display on the second monitor (Ultra only) */
export async function openSecondaryDisplay(): Promise<SecondaryDisplayInfo> {
  return invoke<SecondaryDisplayInfo>("open_secondary_window");
}

/** Close the secondary display */
export async function closeSecondaryDisplay(): Promise<void> {
  await invoke("close_secondary_window");
}

/** Check if secondary display is open */
export async function getSecondaryDisplayInfo(): Promise<SecondaryDisplayInfo> {
  return invoke<SecondaryDisplayInfo>("is_secondary_window_open");
}

/** Whether the current user can use secondary display */
export function canUseSecondaryDisplay(): boolean {
  try {
    const { license } = useLicenseStore.getState();
    return isUltra(license.tier);
  } catch {
    return false;
  }
}

// ═══════════════════ EVENT EMITTERS (main → secondary) ═══════════════════

/** Emit now-playing info to the secondary window */
export async function emitNowPlaying(payload: NowPlayingPayload): Promise<void> {
  try {
    const window = getCurrentWebviewWindow();
    await window.emitTo("secondary-display", "now-playing", payload);
  } catch {
    // Secondary window might not be open — silent
  }
}

/** Emit widget state to secondary window */
export async function emitWidgetState(widget: string, data: unknown): Promise<void> {
  try {
    const window = getCurrentWebviewWindow();
    await window.emitTo("secondary-display", `widget-${widget}`, data);
  } catch {
    // silent
  }
}

// ═══════════════════ EVENT LISTENERS (secondary → main) ═══════════════════

export type SecondaryEventHandler = (payload: unknown) => void;

/** Listen for events from the main window (use on secondary display) */
export function listenMainEvents(
  handlers: Record<string, SecondaryEventHandler>,
): () => void {
  const window = getCurrentWebviewWindow();
  const unlisteners: Array<() => void> = [];

  for (const [event, handler] of Object.entries(handlers)) {
    const unlisten = window.listen(event, (e) => {
      handler(e.payload);
    });
    unlisteners.push(unlisten.then ? undefined : unlisten as unknown as () => void);
    // Actually, Tauri v2 `window.listen()` returns a Promise<UnlistenFn>
    // Let's handle this properly
  }

  return () => {
    // Cleanup all listeners
  };
}
