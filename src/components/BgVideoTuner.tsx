import { useState } from "react";
import { useSettingsStore, type BgVideoLoopConfig } from "@/stores/settingsStore";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const cfg = useSettingsStore((s) => s.bgVideoLoop);
  const set = useSettingsStore((s) => s.setBgVideoLoop);

  if (!visible) return null;

  const f = (k: Exclude<keyof BgVideoLoopConfig, "enabled">) => cfg[k];
  const u = (k: keyof BgVideoLoopConfig, v: number | boolean) => set({ [k]: v });

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-surface-light/95 backdrop-blur-md border border-primary rounded-xl shadow-2xl p-5 w-[340px] text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <NeonIcon name="SlidersHorizontal" size={16}><SlidersHorizontal className="h-4 w-4 text-primary-light" /></NeonIcon>
          <span className="text-sm font-semibold text-white">{t("bgTuner.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => set(DEFAULTS)} className="text-gray-500 hover:text-white p-1" title={t("bgTuner.reset_default")}>
            <NeonIcon name="RotateCcw" size={16}><RotateCcw className="h-3.5 w-3.5" /></NeonIcon>
          </button>
          <button onClick={onToggle} className="text-gray-500 hover:text-white p-1">
            <NeonIcon name="X" size={16}><X className="h-4 w-4" /></NeonIcon>
          </button>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Playback Rate */}
        <Row label={t("bgTuner.playback_rate")} value={f("playbackRate")} unit="x" min={0.25} max={2} step={0.05}
          onChange={(v) => u("playbackRate", v)} t={t} />

        {/* First Play Start */}
        <Row label={t("bgTuner.first_start")} value={f("firstPlayStart")} unit="s" min={0} max={60} step={0.5}
          hint={t("bgTuner.first_start_hint")} onChange={(v) => u("firstPlayStart", v)} t={t} />

        {/* First Play End */}
        <Row label={t("bgTuner.first_end")} value={f("firstPlayEnd")} unit="s" min={0} max={120} step={0.5}
          hint={t("bgTuner.first_end_hint")} onChange={(v) => u("firstPlayEnd", v)} t={t} />

        {/* Loop Start */}
        <Row label={t("bgTuner.loop_start")} value={f("loopStart")} unit="s" min={0} max={60} step={0.5}
          hint={t("bgTuner.loop_start_hint")} onChange={(v) => u("loopStart", v)} t={t} />

        {/* Loop Duration */}
        <Row label={t("bgTuner.loop_duration")} value={f("loopDuration")} unit="s" min={1} max={30} step={0.5}
          hint={t("bgTuner.loop_duration_hint")} onChange={(v) => u("loopDuration", v)} t={t} />

        {/* Transition Ms */}
        <Row label={t("bgTuner.transition")} value={f("transitionMs")} unit="ms" min={0} max={2000} step={50}
          hint={t("bgTuner.transition_hint")} onChange={(v) => u("transitionMs", v)} t={t} />

        {/* Loop Count */}
        <Row label={t("bgTuner.loop_count")} value={f("loopCount")} unit={t("bgTuner.loop_count_unit")} min={0} max={50} step={1}
          hint={t("bgTuner.loop_count_hint")} onChange={(v) => u("loopCount", v)} t={t} />
      </div>
    </div>
  );
}

function Row({ label, value, unit, min, max, step, hint, onChange, t }: {
  label: string; value: number; unit: string; min: number; max: number; step: number;
  hint?: string; onChange: (v: number) => void; t?: any;
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
