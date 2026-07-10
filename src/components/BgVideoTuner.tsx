import { useState } from "react";
import { useSettingsStore, type BgVideoLoopConfig } from "@/stores/settingsStore";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";

const DEFAULTS: BgVideoLoopConfig = {
  enabled: true,
  loopCount: 0,
  firstPlayStart: 0,
  firstPlayEnd: 0,
  loopStart: 0,
  loopDuration: 3,
  transitionMs: 450,
  playbackRate: 0.7,
};

export default function BgVideoTuner({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const cfg = useSettingsStore((s) => s.bgVideoLoop);
  const set = useSettingsStore((s) => s.setBgVideoLoop);

  if (!visible) return null;

  const f = (k: keyof BgVideoLoopConfig) => cfg[k];
  const u = (k: keyof BgVideoLoopConfig, v: number | boolean) => set({ [k]: v });

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-surface-light/95 backdrop-blur-md border border-primary rounded-xl shadow-2xl p-5 w-[340px] text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary-light" />
          <span className="text-sm font-semibold text-white">背景视频调参</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => set(DEFAULTS)} className="text-gray-500 hover:text-white p-1" title="重置默认">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button onClick={onToggle} className="text-gray-500 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Playback Rate */}
        <Row label="播放速率" value={f("playbackRate")} unit="x" min={0.25} max={2} step={0.05}
          onChange={(v) => u("playbackRate", v)} />

        {/* First Play Start */}
        <Row label="首次开始" value={f("firstPlayStart")} unit="s" min={0} max={60} step={0.5}
          hint="0=从头" onChange={(v) => u("firstPlayStart", v)} />

        {/* First Play End */}
        <Row label="首次结束" value={f("firstPlayEnd")} unit="s" min={0} max={120} step={0.5}
          hint="0=播完" onChange={(v) => u("firstPlayEnd", v)} />

        {/* Loop Start */}
        <Row label="循环起点" value={f("loopStart")} unit="s" min={0} max={60} step={0.5}
          hint="每次循环从第几秒开始" onChange={(v) => u("loopStart", v)} />

        {/* Loop Duration */}
        <Row label="循环时长" value={f("loopDuration")} unit="s" min={1} max={30} step={0.5}
          hint="每次循环播放多少秒" onChange={(v) => u("loopDuration", v)} />

        {/* Transition Ms */}
        <Row label="过渡时长" value={f("transitionMs")} unit="ms" min={0} max={2000} step={50}
          hint="两段视频交叉淡入淡出" onChange={(v) => u("transitionMs", v)} />

        {/* Loop Count */}
        <Row label="循环次数" value={f("loopCount")} unit="次" min={0} max={50} step={1}
          hint="0=无限循环" onChange={(v) => u("loopCount", v)} />
      </div>
    </div>
  );
}

function Row({ label, value, unit, min, max, step, hint, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step: number;
  hint?: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = step < 1 ? value.toFixed(2) : value;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-gray-400">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min} max={max} step={step}
            onChange={(e) => onChange(Math.max(min, Math.min(max, parseFloat(e.target.value) || min)))}
            className="w-16 h-6 bg-surface-lighter border border-primary rounded px-1.5 text-right text-white text-[11px] focus:border-primary-light focus:outline-none"
          />
          <span className="text-gray-600 w-5 text-left">{unit}</span>
        </div>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1 accent-primary-light cursor-pointer"
          style={{ appearance: "auto" }}
        />
        <div className="absolute top-1 h-1 rounded-full bg-primary/20 pointer-events-none left-0" style={{ width: `${pct}%` }} />
      </div>
      {hint && <p className="text-[10px] text-gray-600">{hint}</p>}
    </div>
  );
}
