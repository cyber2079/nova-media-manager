import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, X } from "lucide-react";

interface Props { open: boolean; onClose: () => void; onCreated: () => void; }

export default function NewProjectDialog({ open, onClose, onCreated }: Props) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("dynamic");
  const [license, setLicense] = useState("pro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const create = async () => {
    if (!id.trim() || !name.trim()) { setError("请填写 ID 和名称"); return; }
    if (!/^[a-z0-9.-]+$/.test(id)) { setError("ID 只能包含小写字母、数字、点和连字符"); return; }
    setLoading(true); setError("");
    try {
      await invoke("theme_studio_create_project", { input: { id: id.trim(), name: name.trim(), themeType: type, requiresLicense: license } });
      onCreated();
      onClose();
    } catch (err: any) { setError(err.toString()); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">创建新主题</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="block text-xs text-gray-400 mb-1">项目 ID</label>
            <input value={id} onChange={e => setId(e.target.value)} placeholder="cyber-girl" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-primary/50 outline-none" /></div>
          <div><label className="block text-xs text-gray-400 mb-1">显示名称</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="赛博少女" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-primary/50 outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1">类型</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none">
                <option value="dynamic">dynamic · 动态视频+轮播</option>
                <option value="story">story · 线性剧情</option>
                <option value="static">static · 纯壁纸</option>
                <option value="hybrid">hybrid · 组合</option>
              </select></div>
            <div><label className="block text-xs text-gray-400 mb-1">许可证</label>
              <select value={license} onChange={e => setLicense(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none">
                <option value="pro">Pro</option>
                <option value="ultra">Ultra</option>
              </select></div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 text-sm hover:text-white">取消</button>
            <button onClick={create} disabled={loading} className="flex-1 py-2 rounded-lg bg-primary/20 text-primary-light text-sm font-medium hover:bg-primary/30 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}创建</button>
          </div>
        </div>
      </div>
    </div>
  );
}
