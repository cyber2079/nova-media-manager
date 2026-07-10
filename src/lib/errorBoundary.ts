/**
 * Global error boundary and crash reporting.
 *
 * Captures:
 * - React render errors (via ErrorBoundary component)
 * - Unhandled JS runtime errors (window.onerror)
 * - Unhandled Promise rejections (window.onunhandledrejection)
 *
 * Errors are hashed for deduplication and reported via analytics pipeline.
 */

import { analytics } from "./analytics";

// ═══════════════════ HASHING ═══════════════════

/** Simple non-crypto hash for error deduplication */
function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0; // 32-bit int
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// ═══════════════════ REPORTING ═══════════════════

const seenErrors = new Set<string>();

function reportError(source: string, message: string, stack?: string) {
  const messageHash = hashString(message);
  const stackHash = stack ? hashString(stack) : "";

  // Deduplicate: only report each unique error once per session
  const dedupKey = `${source}:${messageHash}`;
  if (seenErrors.has(dedupKey)) return;
  seenErrors.add(dedupKey);

  // Track via analytics
  analytics.track("error", {
    source,
    message_hash: messageHash,
    stack_hash: stackHash,
  });
}

// ═══════════════════ GLOBAL HANDLERS ═══════════════════

let globalSetup = false;

export function setupGlobalErrorHandlers(): void {
  if (globalSetup) return;
  globalSetup = true;

  // JS runtime errors
  window.addEventListener("error", (event) => {
    // Only handle runtime errors, not resource load errors
    if (event.error instanceof Error) {
      reportError("frontend", event.error.message, event.error.stack);
    }
  });

  // Unhandled Promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (reason instanceof Error) {
      reportError("promise", reason.message, reason.stack);
    } else if (typeof reason === "string") {
      reportError("promise", reason);
    }
    // Prevent default console error
    event.preventDefault();
  });
}

// ═══════════════════ REACT ERROR BOUNDARY ═══════════════════

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI per-section */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    reportError(
      "react",
      error.message,
      (error.stack || "") + "\n" + (errorInfo.componentStack || ""),
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || null; // Silent fallback — don't disrupt UX
    }
    return this.props.children;
  }
}
