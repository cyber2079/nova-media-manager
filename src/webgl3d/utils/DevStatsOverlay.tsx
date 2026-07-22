/**
 * DevStatsOverlay — 开发环境性能面板。
 *
 * 仅在 import.meta.env.DEV 下渲染。通过 MetricsCollector 订阅实时指标。
 * 生产构建 tree-shaking 完全移除。
 *
 * Ref: [02_开发标准 §5.1](docs/webgl3d-spec/02_全局开发强制标准.md)
 */

import { useEffect, useState } from "react";
import type { MetricsSnapshot } from "../renderer/MetricsCollector";

interface Props {
  /** Subscribe function — from MetricsCollector */
  subscribe: (fn: (m: MetricsSnapshot) => void) => () => void;
  /** Initial snapshot */
  initial?: MetricsSnapshot;
}

export default function DevStatsOverlay({ subscribe, initial }: Props) {
  const [m, setM] = useState<MetricsSnapshot>(
    initial ?? { fps: 0, frameTimeMs: 0, jsHeapMB: 0, drawCalls: 0, triangleCount: 0, textureCount: 0, contextLostCount: 0 }
  );

  useEffect(() => subscribe(setM), [subscribe]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-14 left-4 z-50 bg-black/80 backdrop-blur rounded-lg border border-white/10 p-3 font-mono text-[11px] text-gray-400 pointer-events-none select-none">
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div>FPS <span className="text-cyan-400">{m.fps}</span></div>
        <div>帧时间 <span className="text-cyan-400">{m.frameTimeMs}ms</span></div>
        <div>JS Heap <span className="text-cyan-400">{m.jsHeapMB}MB</span></div>
        <div>DrawCalls <span className="text-cyan-400">{m.drawCalls}</span></div>
        <div>三角面 <span className="text-cyan-400">{(m.triangleCount / 1000).toFixed(0)}K</span></div>
        <div>纹理 <span className="text-cyan-400">{m.textureCount}</span></div>
        <div>Context Lost <span className={m.contextLostCount > 0 ? "text-red-400" : "text-cyan-400"}>{m.contextLostCount}</span></div>
        <div></div>
      </div>
    </div>
  );
}
