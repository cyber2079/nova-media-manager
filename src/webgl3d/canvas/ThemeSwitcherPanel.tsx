import { useState } from "react";
import { useThreeDStore } from "../state/threeDStore";
import { getRenderer, getSceneManager } from "../index";

interface ThemeEntry {
  themeId: string;
  name: string;
  version: string;
  status: "active" | "downloaded" | "available" | "locked";
  previewImage?: string;
}

interface Props {
  themes: ThemeEntry[];
  onImport?: () => void;
  onBrowseStore?: () => void;
}

export default function ThemeSwitcherPanel({ themes, onImport, onBrowseStore }: Props) {
  const [switching, setSwitching] = useState<string | null>(null);
  const currentThemeId = useThreeDStore(s => s.scene.themeId);
  const setModuleStatus = useThreeDStore(s => s.setModuleStatus);

  const handleActivate = async (themeId: string) => {
    setSwitching(themeId);
    const rm = getRenderer();
    const sm = getSceneManager();
    if (!rm || !sm) return;

    try {
      setModuleStatus("loading");
      rm.stopLoop();
      const scene = sm.getScene(themeId);
      if (!scene) {
        // Scene not yet registered — load manifest first, then switch
        // (full flow requires NV3D loading, which depends on Rust commands)
        console.warn("[Nova3D] Scene not registered — full NV3D loading requires Rust nv3d_open");
      }
      await sm.switchScene(themeId);
      rm.startLoop();
      setModuleStatus("active");
    } catch (e) {
      console.error("[Nova3D] Theme switch failed:", e);
      setModuleStatus("degraded", String(e));
    } finally {
      setSwitching(null);
    }
  };

  const handleDeactivate = () => {
    const rm = getRenderer();
    rm?.stopLoop();
    setModuleStatus("disabled");
  };

  const activeTheme = themes.find(t => t.themeId === currentThemeId && t.status === "active");

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium text-gray-200">3D 主题</h3>

      {/* Current theme */}
      {activeTheme && (
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{activeTheme.name}</p>
              <p className="text-xs text-gray-500">v{activeTheme.version} · 激活中</p>
            </div>
            <button
              onClick={handleDeactivate}
              className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded border border-red-400/30 hover:border-red-400/50 transition"
            >
              停用
            </button>
          </div>
        </div>
      )}

      {/* Theme list */}
      <div className="space-y-2">
        {themes
          .filter(t => t.themeId !== currentThemeId || t.status !== "active")
          .map(t => (
            <div key={t.themeId} className="bg-white/5 rounded-lg p-3 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300">{t.name}</p>
                <p className="text-xs text-gray-600">
                  v{t.version}
                  {t.status === "downloaded" && " · 已下载"}
                  {t.status === "locked" && " · 会员已过期"}
                  {t.status === "available" && " · 可下载"}
                </p>
              </div>
              {t.status === "downloaded" && (
                <button
                  onClick={() => handleActivate(t.themeId)}
                  disabled={switching === t.themeId}
                  className="text-xs text-cyan-400 hover:text-cyan-300 px-3 py-1 rounded border border-cyan-400/30 hover:border-cyan-400/50 transition disabled:opacity-50"
                >
                  {switching === t.themeId ? "切换中..." : "激活"}
                </button>
              )}
              {t.status === "locked" && (
                <span className="text-xs text-gray-500">已锁定</span>
              )}
              {t.status === "available" && (
                <span className="text-xs text-gray-500">待下载</span>
              )}
            </div>
          ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onImport && (
          <button onClick={onImport} className="text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition">
            + 导入主题文件
          </button>
        )}
        {onBrowseStore && (
          <button onClick={onBrowseStore} className="text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition">
            浏览更多主题...
          </button>
        )}
      </div>
      {themes.length === 0 && (
        <p className="text-xs text-gray-600 text-center py-4">暂无 3D 主题</p>
      )}
    </div>
  );
}
