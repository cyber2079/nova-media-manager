// ── 性能调优 Hook ──
// 启动时调用 applyPerfSettings，运行时监听空闲状态降载

import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/** 应用性能设置（启动时调用一次） */
export function initPerformance() {
  useSettingsStore.getState().applyPerfSettings();
}

/** 空闲降载（挂载即可） */
export function usePerformanceMonitor() {
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idle = useRef(false);

  useEffect(() => {
    const s = useSettingsStore.getState();
    if (!s.perfIdleReduce) return;

    let lastActivity = Date.now();
    const onActivity = () => { lastActivity = Date.now(); idle.current = false; };

    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("click", onActivity, { passive: true });

    idleTimer.current = setInterval(() => {
      const ms = Date.now() - lastActivity;
      if (ms > 5 * 60_000 && !idle.current) {
        idle.current = true;
        try {
          import("@tauri-apps/api/core").then((m) =>
            m.invoke("set_process_priority", { level: "normal" })
          );
        } catch {}
      } else if (ms < 60_000 && idle.current) {
        idle.current = false;
        s.applyPerfSettings();
      }
    }, 30_000);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("click", onActivity);
      if (idleTimer.current) clearInterval(idleTimer.current);
    };
  }, []);
}
