import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App";
import { ToastProvider } from "@/components/Toast";
import { migrateFromLocalStorage } from "@/lib/sqliteStore";
import { useThemeShortcutStore } from "@/stores/themeShortcutStore";
import { setupGlobalErrorHandlers, ErrorBoundary } from "@/lib/errorBoundary";
import "./index.css";

// ── Global error handlers (before anything else can fail) ──
setupGlobalErrorHandlers();

// One-time: migrate localStorage → SQLite (non-blocking)
migrateFromLocalStorage();

// Restore theme shortcut overrides from SQLite (only localStorage-only store)
useThemeShortcutStore.getState().init();

// Disable right-click globally (production + dev)
document.addEventListener("contextmenu", (e) => e.preventDefault());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);
