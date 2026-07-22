/**
 * LoadingOverlay — 主题加载进度遮罩。
 *
 * Phase 1: 封面图 + 名称 + spinner
 * Phase 2: 进度条 + 低模加载提示
 * Phase 3: 后台静默 (不显示)
 * 失败: 重试 + 跳过按钮
 *
 * Ref: [14_UI/UX §2](docs/webgl3d-spec/14_3D配套UI-UX通用交互规范.md)
 */

import { useThreeDStore, type LoadPhase } from "../state/threeDStore";

interface Props {
  themeName?: string;
  heroImage?: string;
  onRetry?: () => void;
  onSkip?: () => void;
}

export default function LoadingOverlay({ themeName = "主题", heroImage, onRetry, onSkip }: Props) {
  const { phase, progress, error } = useThreeDStore(s => s.loading);
  if (phase === "complete" || phase === "idle") return null;

  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
      {heroImage && <img src={heroImage} className="w-64 h-36 object-cover rounded-lg mb-4" alt="" />}
      <h2 className="text-white text-xl mb-2">{themeName}</h2>

      {phase === "manifest" && <Spinner />}
      {phase === "low_res" && (
        <div className="w-64 space-y-2">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-gray-400 text-sm text-center">正在加载场景...</p>
        </div>
      )}
      {phase === "hd_streaming" && <p className="text-gray-400 text-sm">正在优化画质...</p>}

      {error && (
        <div className="mt-4 space-y-2 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <div className="flex gap-3">
            {onRetry && <button onClick={onRetry} className="text-cyan-400 text-sm underline">重试</button>}
            {onSkip && <button onClick={onSkip} className="text-gray-400 text-sm underline">使用低精度模式</button>}
          </div>
        </div>
      )}

      {phase === "low_res" && progress > 95 && progress < 100 && onSkip && (
        <button onClick={onSkip} className="mt-4 text-gray-400 text-sm underline">使用低精度模式</button>
      )}
    </div>
  );
}

function Spinner() {
  return <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />;
}
