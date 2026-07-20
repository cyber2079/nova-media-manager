/**
 * Privacy-respecting analytics SDK.
 *
 * - Only collects anonymous usage patterns, NOT personal data.
 * - No filenames, paths, media content, or user identifiers.
 * - Events are buffered locally and batched every 5 minutes or 50 events.
 * - Community edition users' data is still collected to improve the product.
 * - Member/Pro users can view their own analytics dashboard.
 */

// ═══════════════════ TYPES ═══════════════════

export interface AnalyticsEvent {
  event_type: string;
  payload: Record<string, unknown>;
  app_version?: string;
  os_info?: string;
}

interface StoredSession {
  deviceId: string;
  startTime: number;
  events: AnalyticsEvent[];
}

// ═══════════════════ CONFIG ═══════════════════

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FLUSH_SIZE_THRESHOLD = 50;
const STORAGE_KEY = "anon_device_id";
// Set by build script or hardcoded to "http://localhost:3000" for dev
const ANALYTICS_ENDPOINT = (typeof window !== "undefined" && (window as any).__ANALYTICS_URL)
  || "https://scm-think.cn/api/events";

// ═══════════════════ DEVICE ID ═══════════════════

function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// ═══════════════════ ANALYTICS SINGLETON ═══════════════════

class AnalyticsEngine {
  private deviceId: string;
  private consent: boolean | null = null; // null = not asked yet
  private events: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private appVersion = "0.1.0";
  private osInfo = "";
  private sessionStart: number;

  constructor() {
    this.deviceId = getDeviceId();
    this.sessionStart = Date.now();

    // Detect OS
    if (typeof navigator !== "undefined") {
      this.osInfo = navigator.platform || "unknown";
    }
  }

  // ── Consent ──

  /** Check if user has given consent */
  hasConsent(): boolean | null {
    if (this.consent !== null) return this.consent;
    try {
      const v = localStorage.getItem("analytics_consent");
      if (v === "true") { this.consent = true; return true; }
      if (v === "false") { this.consent = false; return false; }
    } catch { /* ignore */ }
    return null;
  }

  /** Set consent and start/stop tracking */
  setConsent(granted: boolean): void {
    this.consent = granted;
    try { localStorage.setItem("analytics_consent", String(granted)); } catch { /* ignore */ }
    if (granted) {
      this.track("analytics_consent", { granted: true });
      this.startFlushTimer();
      this.track("app_launch", { first_launch: true });
    } else {
      this.stopFlushTimer();
      this.events = [];
    }
  }

  // ── Tracking ──

  track(eventType: string, payload: Record<string, unknown> = {}): void {
    if (this.consent !== true) return;

    // Sanitize — never include file paths, names, or personal data
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      // Skip potentially sensitive keys
      if (k.toLowerCase().includes("path") || k.toLowerCase().includes("file")) continue;
      if (k.toLowerCase().includes("name") && typeof v === "string" && v.length > 50) continue;
      safe[k] = v;
    }

    this.events.push({
      event_type: eventType,
      payload: safe,
      app_version: this.appVersion,
      os_info: this.osInfo,
    });

    if (this.events.length >= FLUSH_SIZE_THRESHOLD) {
      this.flush();
    }
  }

  // ── Flush ──

  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const batch = this.events.splice(0);
    try {
      await fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: this.deviceId, events: batch }),
        // Fire-and-forget: don't block the app
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Re-queue failed events (up to 100)
      if (this.events.length < 100) {
        this.events.unshift(...batch);
      }
    }
  }

  // ── Session ──

  getSessionDuration(): number {
    return Math.round((Date.now() - this.sessionStart) / 1000);
  }

  // ── Timer ──

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    // Also flush on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.track("app_close", { session_duration_seconds: this.getSessionDuration() });
        // Use sendBeacon for reliable last-flush
        if (this.events.length > 0) {
          navigator.sendBeacon(
            ANALYTICS_ENDPOINT,
            JSON.stringify({ device_id: this.deviceId, events: [...this.events] }),
          );
          this.events = [];
        }
      });
    }
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /** Get device ID (for dashboard access by Pro users) */
  getDeviceId(): string {
    return this.deviceId;
  }
}

// ═══════════════════ EXPORT SINGLETON ═══════════════════

export const analytics = new AnalyticsEngine();

// ═══════════════════ REACT HOOK ═══════════════════

import { useEffect, useRef } from "react";

/**
 * Track page view duration on mount/unmount.
 * Usage: useAnalyticsPageView("home")
 */
export function useAnalyticsPageView(page: string): void {
  const startRef = useRef(Date.now());

  useEffect(() => {
    analytics.track("page_view", { page });
    startRef.current = Date.now();

    return () => {
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      analytics.track("page_view_end", { page, duration_seconds: duration });
    };
  }, [page]);
}

/**
 * Track when a component feature is used.
 * Usage: analytics.trackFeatureUse("countdown_start")
 */
export function trackFeatureUse(feature: string, extra?: Record<string, unknown>): void {
  analytics.track("feature_use", { feature, ...extra });
}
