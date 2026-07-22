/**
 * ThreeDErrorBoundary — 3D 画布异常边界。
 *
 * 捕获第三层所有渲染异常 → 降级 UI → 不向第一层传播
 * 异常时自动恢复原生壁纸，记录崩溃日志。
 *
 * Ref: [12_画布组件 §3](docs/webgl3d-spec/12_WebGL画布通用组件开发规范.md)
 */

import React from "react";
import { log3D } from "../bridge/log";

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; errorInfo: string | null; }

export class ThreeDErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    log3D.error("CANVAS_CRASH", `${error.message} | stack: ${error.stack?.slice(0, 200)} | componentStack: ${errorInfo.componentStack?.slice(0, 200)}`);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <StaticPreviewFallback />;
    }
    return this.props.children;
  }
}

function StaticPreviewFallback() {
  return (
    <div className="fixed inset-0 z-0 flex items-center justify-center" style={{ background: "#0a0a1a" }}>
      <div className="text-center space-y-3">
        <div className="text-gray-400 text-lg">⚠</div>
        <p className="text-gray-500 text-sm">3D 场景加载异常</p>
        <p className="text-gray-600 text-xs">模块已自动降级，不影响主应用正常运行</p>
      </div>
    </div>
  );
}
