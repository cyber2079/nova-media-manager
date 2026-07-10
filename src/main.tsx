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

// 禁用浏览器右键菜单
document.addEventListener("contextmenu", (e) => e.preventDefault());
// 禁止拖拽（避免图片/图标被拖到浏览器外部打开）
document.addEventListener("dragstart", (e) => e.preventDefault());
// 禁用 Ctrl+A 全选
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "a") e.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);
