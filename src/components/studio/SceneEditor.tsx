import { useState, useEffect } from "react";
import { X, Save, Play, Loader2 } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
interface SceneData {
  id: string; status: string; sceneType: string;
  promptKey: string; description: string; promptText: string;
  thumbnailUrl: string; thumbnailExists: boolean; assetSize: number; i18nKey: string;
}

interface Props {
  open: boolean;
  scene: SceneData | null;
  prompts: any;
  globalStyle: string;
  onClose: () => void;
  onSave: (sceneId: string, data: { status: string; promptKey: string; description: string; sceneType: string }, promptUpdate?: { type: string; prompt: string; model?: string; ratio?: string }) => void;
  onGenerateOne: (promptKey: string) => void;
}

export default function SceneEditor({ open, scene, prompts, globalStyle, onClose, onSave, onGenerateOne }: Props) {
  const [status, setStatus] = useState("");
  const [promptKey, setPromptKey] = useState("");
  const [description, setDescription] = useState("");
  const [sceneType, setSceneType] = useState("image");
  const [promptText, setPromptText] = useState("");
  const [model, setModel] = useState("");
  const [ratio, setRatio] = useState("16:9");
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    if (!scene) return;
    setStatus(scene.status);
    setPromptKey(scene.promptKey);
    setDescription(scene.description || "");
    setSceneType(scene.sceneType);
    setPromptText(scene.promptText || "");

    // Find prompt config
    const spec = prompts?.scenes?.[scene.promptKey] || prompts?.faces?.[scene.promptKey.replace("face-", "")] || prompts?.background;
    if (spec) { setModel(spec.model || ""); setRatio(spec.ratio || "16:9"); }
  }, [scene, prompts]);

  if (!open || !scene) return null;

  const handleSave = () => {
    let promptUpdate;
    if (promptText.trim() && model) {
      promptUpdate = { type: sceneType, prompt: promptText, model, ratio };
    }
    onSave(scene.id, { status, promptKey, description, sceneType }, promptUpdate);
    onClose();
  };

  const handleGenOne = () => {
    setGenLoading(true);
    onGenerateOne(promptKey);
    setTimeout(() => setGenLoading(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">编辑: {scene.id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><NeonIcon name="X" size={16}><X className="h-5 w-5" /></NeonIcon></button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div><label className="block text-xs text-gray-400 mb-1">场景 ID</label>
            <input value={scene.id} disabled className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-500 text-sm" /></div>
          <div><label className="block text-xs text-gray-400 mb-1">状态</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none">
              <option value="todo">todo</option><option value="done">done</option><option value="skip">skip</option></select></div>

          <div><label className="block text-xs text-gray-400 mb-1">提示词 Key</label>
            <input value={promptKey} onChange={e => setPromptKey(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono outline-none" /></div>
          <div><label className="block text-xs text-gray-400 mb-1">素材类型</label>
            <select value={sceneType} onChange={e => setSceneType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none">
              <option value="image">🖼️ image</option><option value="video">🎥 video</option><option value="audio">🔊 audio</option></select></div>

          <div className="col-span-2"><label className="block text-xs text-gray-400 mb-1">描述</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none" /></div>
        </div>

        <div className="mb-5">
          <label className="block text-xs text-gray-400 mb-1">
            AI 提示词 {globalStyle && <span className="text-primary-light/60">（全局风格: {globalStyle.slice(0, 40)}...）</span>}
          </label>
          <textarea value={promptText} onChange={e => setPromptText(e.target.value)} rows={4}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono outline-none resize-vertical" />
          <div className="flex gap-3 mt-2">
            <div className="flex-1"><label className="block text-[10px] text-gray-500 mb-0.5">模型</label>
              <input value={model} onChange={e => setModel(e.target.value)} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/5 text-gray-300 text-xs font-mono outline-none" /></div>
            <div className="w-24"><label className="block text-[10px] text-gray-500 mb-0.5">比例</label>
              <select value={ratio} onChange={e => setRatio(e.target.value)} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/5 text-gray-300 text-xs outline-none">
                <option value="1:1">1:1</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="9:16">9:16</option></select></div>
          </div>
        </div>

        {/* Asset preview */}
        {scene.thumbnailExists && (
          <div className="mb-5 rounded-xl overflow-hidden border border-green-400/10">
            <img
              src={`/${scene.thumbnailUrl}`}
              alt={scene.description}
              className="w-full aspect-video object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="p-2 bg-green-400/5 text-[10px] text-green-400/70 flex items-center justify-between">
              <span className="font-mono truncate">{(scene.thumbnailUrl || "").split("/").pop()}</span>
              <span>{(scene.assetSize / 1024).toFixed(0)} KB</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleGenOne} disabled={genLoading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm hover:bg-accent/30 disabled:opacity-50">
            {genLoading ? <NeonIcon name="Loader2" size={16}><Loader2 className="h-3.5 w-3.5 animate-spin" /></NeonIcon> : <NeonIcon name="Play" size={16}><Play className="h-3.5 w-3.5" /></NeonIcon>}
            单独生成
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-sm hover:text-white">取消</button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary-light text-sm font-medium hover:bg-primary/30">
            <NeonIcon name="Save" size={16}><Save className="h-3.5 w-3.5" /></NeonIcon>保存
          </button>
        </div>
      </div>
    </div>
  );
}
