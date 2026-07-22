/**
 * ThreeDCanvas — 3D 画布组件。
 *
 * 生命周期：挂载 → createContext → 启动渲染循环 → 卸载 → dispose
 * 自动处理 Resize / DPI 适配，通过 ResizeObserver 防抖。
 *
 * Ref: [12_画布组件 §2](docs/webgl3d-spec/12_WebGL画布通用组件开发规范.md)
 */

import { useEffect, useRef, useCallback } from "react";
import { useThreeDStore } from "../state/threeDStore";
import type { ModuleStatus } from "../state/threeDStore";
import { getRenderer, getSceneManager } from "../index";

export type CanvasState = ModuleStatus;

export interface ThreeDCanvasProps {
  themeId: string | null;
  performanceMode?: "quality" | "balanced" | "powersave";
  onStateChange?: (state: CanvasState) => void;
  onPointerEvent?: (type: string, x: number, y: number) => void;
}

export default function ThreeDCanvas({
  themeId, performanceMode = "quality", onStateChange, onPointerEvent,
}: ThreeDCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const setModuleStatus = useThreeDStore(s => s.setModuleStatus);

  // ── Mount: create context + render loop ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const rm = getRenderer();
    if (!canvas || !rm) return;

    try {
      rm.setPerformanceMode(performanceMode);

      // Resize observer
      const handleResize = debounce(() => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        rm.resize(rect.width, rect.height, dpr);
      }, 200);

      observerRef.current = new ResizeObserver(handleResize);
      observerRef.current.observe(canvas);
      handleResize(); // initial size

      setModuleStatus("active");
      onStateChange?.("active");

      // Pointer events
      const onPointer = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        onPointerEvent?.(e.type, e.clientX - rect.left, e.clientY - rect.top);
      };
      canvas.addEventListener("pointermove", onPointer);
      canvas.addEventListener("pointerdown", onPointer);
      canvas.addEventListener("pointerup", onPointer);

      return () => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        rm.stopLoop();
        canvas.removeEventListener("pointermove", onPointer);
        canvas.removeEventListener("pointerdown", onPointer);
        canvas.removeEventListener("pointerup", onPointer);
      };
    } catch (e) {
      console.error("[Nova3D] ThreeDCanvas mount failed:", e);
      setModuleStatus("disabled", String(e));
    }
  }, []);

  // ── Power management: pause on blur, resume on focus ──────────────
  useEffect(() => {
    const rm = getRenderer();
    if (!rm) return;

    const onBlur = () => rm.stopLoop();
    const onFocus = () => rm.startLoop();

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    // Also check visibility (tab switch / minimize in WebView2)
    const onVis = () => { if (document.hidden) rm.stopLoop(); else rm.startLoop(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ── Theme switch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!themeId) return;
    const sm = getSceneManager();
    if (!sm) return;

    setModuleStatus("loading");
    useThreeDStore.getState().setTransition("loading");

    const scene = sm.getScene(themeId);
    if (!scene) {
      // Not yet registered — wait for host to register then switch
      return;
    }

    sm.switchScene(themeId).then(() => {
      getRenderer()?.startLoop();
      setModuleStatus("active");
      useThreeDStore.getState().setTransition("fade_in");
      onStateChange?.("active");
    }).catch(e => {
      console.error("[Nova3D] Theme switch failed:", e);
      setModuleStatus("degraded", String(e));
    });
  }, [themeId]);

  // ── Pointer events check — block when UI overlay open ────────────────
  const shouldReceive = useCallback(() => {
    return document.querySelector("[data-ui-overlay]") === null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0"
      style={{ zIndex: 0, display: "block" }}
      onPointerDown={e => { if (shouldReceive()) { const r = (e.target as HTMLCanvasElement).getBoundingClientRect(); onPointerEvent?.("pointerdown", e.clientX - r.left, e.clientY - r.top); } }}
    />
  );
}

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  return () => { clearTimeout(timer); timer = setTimeout(fn, ms); };
}
