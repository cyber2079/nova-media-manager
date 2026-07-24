// 排序控制栏 — 纯图标，点击后触发破碎重组动画

import { useMemo, useCallback, useState } from "react";
import { ArrowDownUp, ArrowUpNarrowWide, ArrowDownWideNarrow, Clock, CalendarArrowUp, CalendarArrowDown } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { cn } from "@/lib/utils";

export type SortKey = string;

export interface SortOption {
  key: SortKey;
  icon: React.ReactNode;
  label: string;
}

export interface SortBarProps {
  options: SortOption[];
  active: SortKey;
  onChange: (key: SortKey) => void;
  className?: string;
}

export default function SortBar({ options, active, onChange, className }: SortBarProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          title={opt.label}
          className={cn(
            "h-8 w-8 flex items-center justify-center rounded-lg transition-all duration-200",
            active === opt.key
              ? "bg-primary/15 text-primary-light shadow-sm"
              : "text-gray-500 hover:text-gray-300 hover:bg-white/5",
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

/** 电影排序：默认 / 名称 / 日期 / 时长 */
export function useMovieSortOptions(): SortOption[] {
  return useMemo(() => [
    { key: "default",     icon: <NeonIcon name="ArrowDownUp" size={16}><ArrowDownUp className="h-3.5 w-3.5" /></NeonIcon>,              label: "默认" },
    { key: "nameAsc",     icon: <NeonIcon name="ArrowUpNarrowWide" size={16}><ArrowUpNarrowWide className="h-3.5 w-3.5" /></NeonIcon>,        label: "名称 A→Z" },
    { key: "nameDesc",    icon: <NeonIcon name="ArrowDownWideNarrow" size={16}><ArrowDownWideNarrow className="h-3.5 w-3.5" /></NeonIcon>,      label: "名称 Z→A" },
    { key: "dateAsc",     icon: <NeonIcon name="CalendarArrowUp" size={16}><CalendarArrowUp className="h-3.5 w-3.5" /></NeonIcon>,          label: "最早添加" },
    { key: "dateDesc",    icon: <NeonIcon name="CalendarArrowDown" size={16}><CalendarArrowDown className="h-3.5 w-3.5" /></NeonIcon>,        label: "最近添加" },
    { key: "durationAsc", icon: <span className="flex items-center"><NeonIcon name="Clock" size={16}><Clock className="h-3.5 w-3.5" /></NeonIcon><span className="text-[7px] ml-0.5 -mt-1 font-bold">↑</span></span>, label: "时长最短" },
    { key: "durationDesc",icon: <span className="flex items-center"><NeonIcon name="Clock" size={16}><Clock className="h-3.5 w-3.5" /></NeonIcon><span className="text-[7px] ml-0.5 -mt-1 font-bold">↓</span></span>, label: "时长最长" },
  ], []);
}

/** 通用排序：默认 / 名称 / 日期（音乐、图片、游戏） */
export function useNameSortOptions(): SortOption[] {
  return useMemo(() => [
    { key: "default",  icon: <NeonIcon name="ArrowDownUp" size={16}><ArrowDownUp className="h-3.5 w-3.5" /></NeonIcon>,              label: "默认" },
    { key: "nameAsc",  icon: <NeonIcon name="ArrowUpNarrowWide" size={16}><ArrowUpNarrowWide className="h-3.5 w-3.5" /></NeonIcon>,        label: "名称 A→Z" },
    { key: "nameDesc", icon: <NeonIcon name="ArrowDownWideNarrow" size={16}><ArrowDownWideNarrow className="h-3.5 w-3.5" /></NeonIcon>,      label: "名称 Z→A" },
    { key: "dateAsc",  icon: <NeonIcon name="CalendarArrowUp" size={16}><CalendarArrowUp className="h-3.5 w-3.5" /></NeonIcon>,          label: "最早添加" },
    { key: "dateDesc", icon: <NeonIcon name="CalendarArrowDown" size={16}><CalendarArrowDown className="h-3.5 w-3.5" /></NeonIcon>,        label: "最近添加" },
  ], []);
}

/** 排序切换时触发破碎重组动画 */
export function useSortAnim() {
  const [animating, setAnimating] = useState(false);

  const triggerSort = useCallback((fn: () => void) => {
    fn();
    setAnimating(true);
    setTimeout(() => setAnimating(false), 450);
  }, []);

  return { animating, triggerSort } as const;
}
