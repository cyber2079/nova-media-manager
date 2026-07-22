/**
 * DialogBox — 剧情弹窗。
 *
 * 打字机效果逐字显示对话、说话人标签、多选项
 * 键盘操作: Space/Enter 推进，1-9 选择选项
 *
 * Ref: [14_UI/UX §3](docs/webgl3d-spec/14_3D配套UI-UX通用交互规范.md)
 */

import { useEffect, useState, useCallback } from "react";
import { useThreeDStore, type DialogChoice } from "../state/threeDStore";

interface I18nResolver {
  t: (key: string) => string;
}

interface Props {
  i18n: I18nResolver;
  onSelectChoice?: (choice: DialogChoice) => void;
  onAdvance?: () => void;
}

export default function DialogBox({ i18n, onSelectChoice, onAdvance }: Props) {
  const dialog = useThreeDStore(s => s.dialog);
  const advanceDialog = useThreeDStore(s => s.advanceDialog);
  const setDialog = useThreeDStore(s => s.setDialog);

  const textKey = `dialog.${dialog.currentDialogId}.line_${dialog.currentLineIndex}`;
  const speakerKey = `dialog.${dialog.currentDialogId}.speaker`;
  const text = i18n.t(textKey) ?? textKey;
  const speaker = i18n.t(speakerKey);

  const [displayedText, done] = useTypewriter(text, dialog.isTyping ? 25 : 0);
  const numChoices = dialog.choices.length;

  // Mark typing complete
  useEffect(() => {
    if (done && dialog.isTyping) {
      setDialog({ isTyping: false });
    }
  }, [done]);

  // Keyboard shortcuts
  const onKey = useCallback((e: KeyboardEvent) => {
    if (dialog.isTyping) { setDialog({ isTyping: false }); return; }
    if (numChoices > 0) {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < numChoices) {
        onSelectChoice?.(dialog.choices[idx]);
        return;
      }
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onAdvance?.();
      advanceDialog();
    }
  }, [dialog.isTyping, numChoices, dialog.choices, onSelectChoice, onAdvance]);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  if (!dialog.currentDialogId) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20 w-[560px] max-w-[90vw] bg-black/85 border border-white/10 rounded-xl p-5 backdrop-blur-xl"
      onClick={() => { if (dialog.isTyping) setDialog({ isTyping: false }); else { onAdvance?.(); advanceDialog(); } }}
    >
      {/* Speaker */}
      {speaker && <p className="text-cyan-400 text-xs mb-2 tracking-wide">{speaker}</p>}

      {/* Text with typewriter */}
      <p className="text-white text-sm leading-relaxed min-h-[2.5em]">
        {displayedText}
        {dialog.isTyping && <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse align-middle" />}
      </p>

      {/* Choices */}
      {numChoices > 0 && !dialog.isTyping && (
        <div className="mt-4 space-y-1.5">
          {dialog.choices.map((c, i) => (
            <button key={c.id} onClick={e => { e.stopPropagation(); onSelectChoice?.(c); }}
              className="block w-full text-left text-cyan-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 text-sm transition">
              <span className="text-gray-500 mr-2">{i + 1}.</span>
              {i18n.t(c.textKey) ?? c.textKey}
            </button>
          ))}
        </div>
      )}

      {/* Continue hint */}
      {numChoices === 0 && !dialog.isTyping && (
        <p className="text-gray-500 text-[11px] mt-3">点击或按 Space 继续</p>
      )}
    </div>
  );
}

// ─── Typewriter hook ─────────────────────────────────────────────────────

function useTypewriter(text: string, speed: number): [string, boolean] {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (speed === 0) { setDisplayed(text); setDone(true); return; }
    setDisplayed(""); setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(timer); setDone(true); }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return [displayed, done];
}
