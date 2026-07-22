/**
 * InteractionHint — 悬浮交互提示。
 *
 * 鼠标悬停在可交互物体上时显示操作标签
 * 拖拽反馈：grab → grabbing 光标
 *
 * Ref: [14_UI/UX §4](docs/webgl3d-spec/14_3D配套UI-UX通用交互规范.md)
 */

import { useThreeDStore } from "../state/threeDStore";

interface Props {
  /** Get i18n label for an interaction ID */
  getLabel?: (id: string) => string;
  mouseX: number;
  mouseY: number;
}

export default function InteractionHint({ getLabel, mouseX, mouseY }: Props) {
  const { hoveredObjectId, draggingPropId } = useThreeDStore(s => s.interaction);

  // Drag feedback
  if (draggingPropId) {
    return (
      <div className="fixed pointer-events-none z-[15]" style={{ left: mouseX + 16, top: mouseY - 20 }}>
        <div className="bg-black/70 backdrop-blur text-white text-xs px-2 py-1 rounded">拖拽中...</div>
      </div>
    );
  }

  // Hover hint
  if (!hoveredObjectId) return null;
  const label = getLabel?.(hoveredObjectId) ?? hoveredObjectId;

  return (
    <div className="fixed pointer-events-none z-[15]" style={{ left: mouseX + 16, top: mouseY - 20 }}>
      <div className="bg-black/70 backdrop-blur text-white text-xs px-2 py-1 rounded">{label}</div>
    </div>
  );
}
