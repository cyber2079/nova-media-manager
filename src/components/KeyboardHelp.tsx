import { useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Star, X, Maximize2, Minimize2, Settings } from "lucide-react";

interface Shortcut {
  keys: string[];
  desc: string;
  icon?: React.ReactNode;
}

const shortcuts: { section: string; items: Shortcut[] }[] = [
  {
    section: "全屏 / 页面",
    items: [
      { keys: ["Ctrl", "K"], desc: "打开全局搜索", icon: <Search className="h-4 w-4" /> },
      { keys: ["?"], desc: "显示此快捷键面板" },
      { keys: ["F11"], desc: "切换全屏", icon: <Maximize2 className="h-4 w-4" /> },
    ],
  },
  {
    section: "卡片操作",
    items: [
      { keys: ["点击"], desc: "单击电影/音乐 → 播放，单击图片 → 预览，单击游戏 → 启动" },
      { keys: ["点击 ☆"], desc: "收藏 / 取消收藏", icon: <Star className="h-4 w-4 text-yellow-400" /> },
      { keys: ["右键"], desc: "打开上下文菜单：复制路径 / 文件夹中打开 / 属性" },
      { keys: ["拖拽"], desc: "拖拽文件到页面直接导入" },
    ],
  },
  {
    section: "批量操作",
    items: [
      { keys: ["点击 ☑"], desc: "勾选卡片进入批量模式" },
      { keys: ["全选"], desc: "批量栏中点击「全选」选中当前页所有项" },
      { keys: ["批量标签"], desc: "为所有选中项统一追加标签" },
      { keys: ["批量删除"], desc: "一次删除所有选中项" },
      { keys: ["X", "或", "Esc"], desc: "退出批量模式", icon: <X className="h-4 w-4" /> },
    ],
  },
  {
    section: "设置",
    items: [
      { keys: ["点击 ⚙"], desc: "打开设置：语言、自启、主题", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

export default function KeyboardHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onKey]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {shortcuts.map((section) => (
            <div key={section.section}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                {section.section}
              </h4>
              <div className="space-y-1.5">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-300">{item.desc}</span>
                    <span className="flex items-center gap-1 shrink-0 ml-3">
                      {item.icon && <span className="text-gray-400">{item.icon}</span>}
                      {item.keys.map((k, j) => (
                        <span key={j}>
                          {k === "或" ? (
                            <span className="text-[10px] text-gray-600 mx-0.5">或</span>
                          ) : (
                            <kbd className="inline-flex items-center rounded bg-surface-lighter px-1.5 py-0.5 text-[10px] font-mono text-gray-400 border border-primary">
                              {k}
                            </kbd>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
