import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App";
import SecondaryDisplay from "@/secondary/SecondaryDisplay";
import { ToastProvider } from "@/components/Toast";
import { migrateFromLocalStorage } from "@/lib/sqliteStore";
import { useThemeShortcutStore } from "@/stores/themeShortcutStore";
import { setupGlobalErrorHandlers, ErrorBoundary } from "@/lib/errorBoundary";
import "./index.css";

setupGlobalErrorHandlers();
migrateFromLocalStorage();
useThemeShortcutStore.getState().init();

const isSecondary = new URLSearchParams(location.search).has("secondary");

if (!isSecondary) {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "a") e.preventDefault();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {isSecondary ? (
        <SecondaryDisplay />
      ) : (
        <ToastProvider>
          <App />
        </ToastProvider>
      )}
    </ErrorBoundary>
  </StrictMode>
);
