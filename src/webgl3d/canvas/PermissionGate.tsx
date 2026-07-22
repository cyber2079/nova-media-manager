/**
 * PermissionGate — 权限拦截。
 *
 * Free 用户：完全无感知，不显示 3D 入口
 * 会员过期：显示续费引导，数据不删
 *
 * 实际权限检查通过 useGate("premium-theme") 走现有 license 体系。
 * 本组件是 UI 层拦截——Rust 侧有独立的二次校验。
 *
 * Ref: [14_UI/UX §6](docs/webgl3d-spec/14_3D配套UI-UX通用交互规范.md)
 * Ref: [01_产品通用规范 §2.3](docs/webgl3d-spec/01_产品通用规范.md)
 */

import type { ReactNode } from "react";

interface Props {
  isMember: boolean;
  isExpired: boolean;
  /** 点击升级按钮 */
  onUpgrade?: () => void;
  children: ReactNode;
}

export default function PermissionGate({ isMember, isExpired, onUpgrade, children }: Props) {
  // Free user — no 3D entry at all
  if (!isMember) return null;

  // Expired member — locked, show upgrade prompt
  if (isExpired) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="text-center space-y-4">
          <div className="text-gray-400 text-lg">🔒</div>
          <h2 className="text-white text-xl">3D 主题已暂停</h2>
          <p className="text-gray-400 text-sm">会员已过期，续费后可继续使用</p>
          <button onClick={onUpgrade} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg transition">
            续费升级
          </button>
          <p className="text-gray-600 text-xs">你的主题和存档仍保留在本地</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
