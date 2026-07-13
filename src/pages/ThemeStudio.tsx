import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Plus, Play, Package, Eye, RefreshCw,
  CheckCircle, Clock, XCircle, AlertCircle, Loader2,
  Image, Video, Music, ChevronUp, ChevronDown, Trash2,
  Save, X,
} from "lucide-react";
import NewProjectDialog from "@/components/studio/NewProjectDialog";

interface ThemeProject {
  id: string; name: string; version: string; themeType: string;
  status: string; requiresLicense: string; description?: string;
  assetCount: number; doneCount: number; scriptNodeCount: number; totalAssetBytes: number;
}

interface ScriptNode {
  id: string; label: string; background: string; face: string; text: string; bgm: string;
  skillShow: boolean; thumbOk: boolean; thumbUrl: string; thumbSize: number;
  i18nPreview: string; faceOk: boolean; faceUrl: string;
}

interface AssetItem {
  id: string; status: string; assetType: string; path: string; description: string;
  exists: boolean; thumbUrl: string; size: number;
}

interface ThemeDetail {
  manifest: any; prompts: any; script: ScriptNode[]; assets: AssetItem[];
  typeDescription: string;
}

const TYPEL: Record<string, { emoji: string; label: string }> = {
  story: { emoji: "🎬", label: "剧情" }, dynamic: { emoji: "❄️", label: "动态" },
  static: { emoji: "🏠", label: "静态" }, hybrid: { emoji: "🔀", label: "混合" },
};

const BGM_OPTIONS = ["", "start", "main"];

export default function ThemeStudioPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [projects, setProjects] = useState<ThemeProject[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThemeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [genLog, setGenLog] = useState("");
  const [genRunning, setGenRunning] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [validating, setValidating] = useState(false);
  const [valResult, setValResult] = useState<{ ok: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [tab, setTab] = useState<"script" | "assets">("script");
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editData, setEditData] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const loadProjects = useCallback(async () => {
    try { setProjects(await invoke<ThemeProject[]>("theme_studio_list_projects")); } catch {}
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true); setImgErrors(new Set()); setEditingIdx(-1);
    try { setDetail(await invoke<ThemeDetail>("theme_studio_get_project", { themeId: id })); setSelected(id); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => {
    if (projects.length > 0 && !selected) loadDetail(projects[0].id);
    else if (projects.length === 0) { setSelected(null); setDetail(null); }
  }, [projects]);

  const themeTypeName = detail?.manifest.type ? TYPEL[detail.manifest.type]?.label ?? "" : "";
  const doneCount = detail?.assets.filter(a => a.exists).length ?? 0;
  const scriptPct = detail?.script.length ? Math.round((detail.script.filter(s => s.thumbOk).length / detail.script.length) * 100) : 0;

  // ── Script edit helpers ──

  const startEdit = (idx: number) => {
    const node = detail?.script[idx];
    if (!node) return;
    setEditingIdx(idx);
    setEditData({
      label: node.label,
      background: node.background,
      face: node.face,
      text: node.text,
      bgm: node.bgm,
      skillShow: node.skillShow,
    });
  };

  const setField = (key: string, value: string | boolean) => {
    setEditData(prev => ({ ...prev, [key]: value }));
  };

  const saveScript = async () => {
    if (!detail || !selected || editingIdx < 0) return;
    setSaving(true);
    try {
      const script = detail.script.map((node, i) => {
        if (i !== editingIdx) return {
          id: node.id, label: node.label, background: node.background, face: node.face,
          text: node.text, bgm: node.bgm, skillShow: node.skillShow,
        };
        return { id: node.id, ...editData };
      });
      await invoke("theme_studio_update_script", { themeId: selected, script });
      setEditingIdx(-1);
      loadDetail(selected);
      loadProjects();
    } catch (e: any) { alert(e); }
    setSaving(false);
  };

  const moveNode = async (fromIdx: number, toIdx: number) => {
    if (!detail || !selected || toIdx < 0 || toIdx >= detail.script.length) return;
    const script = [...detail.script.map(n => ({
      id: n.id, label: n.label, background: n.background, face: n.face,
      text: n.text, bgm: n.bgm, skillShow: n.skillShow,
    }))];
    const [moved] = script.splice(fromIdx, 1);
    script.splice(toIdx, 0, moved);
    try { await invoke("theme_studio_update_script", { themeId: selected, script }); loadDetail(selected); } catch (e: any) { alert(e); }
  };

  const deleteNode = async (idx: number) => {
    if (!detail || !selected) return;
    const script = detail.script.filter((_, i) => i !== idx).map(n => ({
      id: n.id, label: n.label, background: n.background, face: n.face,
      text: n.text, bgm: n.bgm, skillShow: n.skillShow,
    }));
    try { await invoke("theme_studio_update_script", { themeId: selected, script }); loadDetail(selected); if (editingIdx === idx) setEditingIdx(-1); } catch (e: any) { alert(e); }
  };

  const addNode = async () => {
    if (!detail || !selected) return;
    const script = detail.script.map(n => ({
      id: n.id, label: n.label, background: n.background, face: n.face,
      text: n.text, bgm: n.bgm, skillShow: n.skillShow,
    }));
    const newId = `s${script.length + 1}`;
    script.push({ id: newId, label: `场景 ${script.length + 1}`, background: "", face: "", text: "", bgm: "", skillShow: false });
    try { await invoke("theme_studio_update_script", { themeId: selected, script }); loadDetail(selected); } catch (e: any) { alert(e); }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenRunning(true); setGenLog("⚡ 启动生成...\n");
    try { setGenLog(await invoke<string>("theme_studio_generate", { themeId: selected })); } catch (e: any) { setGenLog(`${genLog}\n❌ ${e}`); }
    setGenRunning(false); loadDetail(selected); loadProjects();
  };

  const handleValidate = async () => {
    if (!selected) return;
    setValidating(true);
    try { setValResult(await invoke("theme_studio_validate", { themeId: selected })); } catch {}
    setValidating(false);
  };

  function imgError(id: string) { setImgErrors(prev => { const n = new Set(prev); n.add(id); return n; }); }

  // Available face files from disk
  const faceFiles = [...new Set((detail?.assets ?? []).filter(a => a.path.startsWith("faces/") && a.exists).map(a => a.path.replace("faces/", "").replace(".webp", "")))];
  const assetPaths = (detail?.assets ?? []).filter(a => a.exists).map(a => a.path);
  const editingNode = editingIdx >= 0 && detail ? detail.script[editingIdx] : null;

  // Collect known i18n keys for text autocomplete
  const i18nKeys = useMemo(() => {
    if (!detail || !selected) return [];
    const prefix = selected === "ice-girl" ? "home.ice" : "home.cg";
    const keys: string[] = [];
    // story type → sceneX_text; dynamic type → quote/ascendancy
    if (detail.manifest.type === "story") for (let i = 1; i <= 16; i++) keys.push(`home.cg_scene${i}_text`);
    else {
      keys.push("home.ice_ascendancy_text");
      for (let i = 1; i <= 17; i++) keys.push(`home.ice_quote_${i}`);
    }
    return keys;
  }, [detail, selected]);

  return (
    <div className="h-screen bg-[#080c14] flex flex-col text-white select-none">
      {/* Top Bar */}
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0a0f18]">
        <button onClick={() => nav("/")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> 返回</button>
        {detail ? (
          <>
            <div className="w-px h-5 bg-white/10" />
            <span className="text-sm font-bold text-white">{detail.manifest.name}</span>
            <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">v{detail.manifest.version}</span>
            <span className="text-[11px] text-gray-400">{TYPEL[detail.manifest.type]?.emoji} {themeTypeName}</span>
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${detail.manifest.status === "packaged" ? "bg-green-400/15 text-green-400" : "bg-yellow-400/15 text-yellow-400"}`}>{detail.manifest.status}</span>
            <span className="hidden lg:inline text-[11px] text-gray-600 italic truncate">{detail.typeDescription}</span>
            <div className="flex-1" />
            <button onClick={handleValidate} disabled={validating} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5">
              {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}检查
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30">
              <Package className="h-3 w-3" /> 打包
            </button>
          </>
        ) : (
          <div className="flex-1 text-sm text-gray-500 flex items-center gap-2">选择一个主题项目，或 <button onClick={() => setShowNew(true)} className="text-primary-light hover:underline">创建新的</button></div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Project list */}
        <div className="w-48 shrink-0 border-r border-white/5 bg-[#0a0f18]/50 flex flex-col">
          <div className="px-3 py-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">项目</span>
            <button onClick={() => setShowNew(true)} className="text-gray-400 hover:text-white p-0.5 hover:bg-white/5"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {projects.map(p => (
              <button key={p.id} onClick={() => { loadDetail(p.id); setTab("script"); }}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm ${selected === p.id ? "bg-primary/10 text-primary-light border-l-2 border-primary-light" : "text-gray-400 hover:text-white border-l-2 border-transparent"}`}>
                <span className="text-base shrink-0">{TYPEL[p.themeType]?.emoji ?? "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-medium">{p.name}</div>
                  <div className="text-[10px] text-gray-600">{TYPEL[p.themeType]?.label} · {p.scriptNodeCount}节点</div>
                </div>
              </button>
            ))}
            {projects.length === 0 && <p className="px-3 py-6 text-xs text-gray-600 text-center">尚无项目<br/><button onClick={() => setShowNew(true)} className="text-primary-light/70 hover:text-primary-light mt-1">+ 创建</button></p>}
          </div>
        </div>

        {/* Right */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#060b14]">
          {!detail ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "选择左侧主题项目"}</div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center gap-0 px-4 border-b border-white/5 shrink-0 bg-[#0a0f18]/80">
                <button onClick={() => setTab("script")} className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === "script" ? "border-primary-light text-primary-light" : "border-transparent text-gray-400 hover:text-white"}`}>
                  场景脚本 ({detail.script.length})
                </button>
                <button onClick={() => setTab("assets")} className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === "assets" ? "border-primary-light text-primary-light" : "border-transparent text-gray-400 hover:text-white"}`}>
                  素材清单 ({detail.assets.length})
                </button>
                <div className="flex-1" />
                {tab === "script" && (
                  <button onClick={addNode} className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-gray-400 hover:text-white hover:bg-white/5 rounded">
                    <Plus className="h-3 w-3" /> 添加节点
                  </button>
                )}
              </div>

              {/* ── Script Tab — split view ── */}
              {tab === "script" && (
                <div className="flex-1 flex min-h-0">
                  {/* Timeline list */}
                  <div className={`${editingIdx >= 0 ? "w-96" : "flex-1"} overflow-y-auto p-3 space-y-1.5 transition-all`}>
                    {detail.script.length === 0 ? (
                      <div className="text-center py-16 text-gray-600">
                        <div className="text-4xl mb-3">📝</div>
                        <p className="text-sm">暂无场景脚本</p>
                        <button onClick={addNode} className="text-primary-light/70 hover:text-primary-light mt-2 text-xs">+ 添加第一个节点</button>
                      </div>
                    ) : (
                      detail.script.map((node, idx) => {
                        const hasErr = imgErrors.has(node.id);
                        const isSelected = editingIdx === idx;
                        return (
                          <div key={node.id} className={`flex items-stretch gap-1.5 group cursor-pointer ${isSelected ? "ring-1 ring-primary-light/30 rounded-xl" : ""}`}
                            onClick={() => startEdit(idx)}>
                            <div className="w-6 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-gray-500">{idx + 1}</span>
                            </div>
                            <div className={`flex-1 rounded-xl border overflow-hidden transition-all ${isSelected ? "border-primary-light/40 bg-primary/5" : node.thumbOk ? "border-green-400/15 bg-green-400/3" : "border-white/5 bg-white/[0.02]"}`}>
                              <div className="flex items-stretch">
                                <div className="w-44 shrink-0 aspect-video relative flex items-center justify-center bg-black/20 overflow-hidden">
                                  {node.thumbOk && !hasErr ? (
                                    <img src={`/${node.thumbUrl}`} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => imgError(node.id)} />
                                  ) : (
                                    <Image className="h-4 w-4 text-gray-700" />
                                  )}
                                  <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${node.thumbOk ? "bg-green-400" : "bg-gray-600"}`} />
                                </div>
                                <div className="flex-1 px-3 py-2 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[11px] font-bold text-white">{node.label || node.id}</span>
                                    {node.skillShow && <span className="text-[7px] bg-purple-400/20 text-purple-400 px-1 rounded">技能展示</span>}
                                  </div>
                                  <div className="text-[8px] text-gray-600 font-mono truncate">{node.background || "(默认)"}</div>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {node.face && <span className="text-[8px] text-gray-500">😶 {node.face}</span>}
                                    {node.bgm && <span className="text-[8px] text-gray-500">♪ {node.bgm}</span>}
                                    {node.text && <span className="text-[8px] text-accent/60 font-mono truncate max-w-[140px]">{node.text}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Properties Panel */}
                  {editingIdx >= 0 && editingNode && (
                    <div className="w-80 shrink-0 border-l border-white/5 bg-[#0a0f18] flex flex-col overflow-y-auto">
                      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold text-white">节点 #{editingIdx + 1}</span>
                        <button onClick={() => setEditingIdx(-1)} className="text-gray-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                        {/* ID */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">ID</label>
                          <input value={String(editingNode.id)} disabled className="w-full px-3 py-1.5 rounded-lg bg-white/3 border border-white/5 text-gray-500 text-xs font-mono" />
                        </div>
                        {/* Label */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">标签名称</label>
                          <input value={String(editData.label || "")} onChange={e => setField("label", e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:border-primary/50 outline-none" />
                        </div>
                        {/* Background */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">背景图/视频</label>
                          <select value={String(editData.background || "")} onChange={e => setField("background", e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none">
                            <option value="">(默认背景)</option>
                            {assetPaths.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          {editData.background && (
                            <div className="mt-1.5 aspect-video rounded-lg bg-black/30 overflow-hidden">
                              <img src={`/themes/${selected === "ice-girl" ? "ice%20girl" : "cyber%20girl"}/${editData.background}`}
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                          )}
                        </div>
                        {/* Face */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">表情</label>
                          <div className="flex gap-1.5 flex-wrap mb-1">
                            <button onClick={() => setField("face", "")}
                              className={`px-2 py-0.5 rounded text-[10px] ${!editData.face ? "bg-primary/20 text-primary-light" : "bg-white/5 text-gray-400 hover:text-white"}`}>无</button>
                            {faceFiles.map(f => (
                              <button key={f} onClick={() => setField("face", f)}
                                className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 ${editData.face === f ? "bg-primary/20 text-primary-light" : "bg-white/5 text-gray-400 hover:text-white"}`}>
                                {f}
                              </button>
                            ))}
                          </div>
                          {editData.face && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/5 bg-black/30">
                              <img src={`/themes/${selected === "ice-girl" ? "ice%20girl" : "cyber%20girl"}/faces/${editData.face}.webp`}
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                          )}
                        </div>
                        {/* Text (i18n key) */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">文本 (i18n key)</label>
                          <select value={String(editData.text || "")} onChange={e => setField("text", e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-mono outline-none">
                            <option value="">(无文本)</option>
                            {i18nKeys.map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                          {editData.text && (
                            <div className="mt-1 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-gray-400 italic line-clamp-3">
                              💬 {t(String(editData.text), "")}
                            </div>
                          )}
                        </div>
                        {/* BGM */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">BGM 分区</label>
                          <div className="flex gap-1">
                            {BGM_OPTIONS.map(o => (
                              <button key={o} onClick={() => setField("bgm", o)}
                                className={`flex-1 py-1 rounded text-[10px] ${editData.bgm === o ? "bg-primary/20 text-primary-light" : "bg-white/5 text-gray-400 hover:text-white"}`}>
                                {o || "无"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Skill Show */}
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={!!editData.skillShow} onChange={e => setField("skillShow", e.target.checked)}
                            className="w-3.5 h-3.5 rounded bg-white/10 border-white/20 accent-primary cursor-pointer" />
                          <label className="text-[10px] text-gray-400">技能展示 (四角飞入动画)</label>
                        </div>

                        {/* Actions */}
                        <div className="pt-3 border-t border-white/5 space-y-2">
                          <div className="flex gap-1">
                            <button onClick={() => moveNode(editingIdx, editingIdx - 1)} disabled={editingIdx === 0}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 text-xs text-gray-400 hover:text-white disabled:opacity-30">
                              <ChevronUp className="h-3 w-3" /> 上移
                            </button>
                            <button onClick={() => moveNode(editingIdx, editingIdx + 1)} disabled={editingIdx >= detail.script.length - 1}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 text-xs text-gray-400 hover:text-white disabled:opacity-30">
                              <ChevronDown className="h-3 w-3" /> 下移
                            </button>
                          </div>
                          <button onClick={() => { if (confirm("删除此节点？")) deleteNode(editingIdx); }}
                            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-400/10 text-red-400 text-xs hover:bg-red-400/20">
                            <Trash2 className="h-3 w-3" /> 删除节点
                          </button>
                          <button onClick={saveScript} disabled={saving}
                            className="w-full flex items-center justify-center gap-1 py-2 rounded-lg bg-primary/20 text-primary-light text-xs font-medium hover:bg-primary/30 disabled:opacity-50">
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}保存到 manifest
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Assets Tab — grid */}
              {tab === "assets" && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-4 gap-3">
                    {detail.assets.map(a => {
                      const hasErr = imgErrors.has(a.id);
                      return (
                        <div key={a.id} className={`relative rounded-xl border overflow-hidden group ${a.exists ? "border-green-400/20 bg-green-400/3" : "border-white/5 bg-white/[0.02]"}`}>
                          <div className="aspect-video flex items-center justify-center bg-black/20 relative">
                            {a.exists && a.thumbUrl && !hasErr ? (
                              <img src={`/${a.thumbUrl}`} className="absolute inset-0 w-full h-full object-cover" onError={() => imgError(a.id)} />
                            ) : (
                              a.assetType === "video" ? <Video className="h-5 w-5 text-gray-700" /> : <Image className="h-5 w-5 text-gray-700" />
                            )}
                            <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${a.exists ? "bg-green-400" : "bg-gray-600"}`} />
                            <span className="absolute top-1 left-1.5 text-[8px] bg-black/60 px-1 rounded">{a.assetType === "video" ? "🎥" : "🖼️"}</span>
                          </div>
                          <div className="px-2 py-1.5">
                            <div className="text-[10px] font-medium text-white truncate">{a.description || a.path}</div>
                            <div className="text-[8px] text-gray-500 font-mono truncate">{a.path}</div>
                            {a.exists && <div className="text-[8px] text-gray-600">{(a.size / 1024).toFixed(0)}K</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Validation */}
              {valResult && (
                <div className={`mx-4 mt-2 p-3 rounded-lg text-xs shrink-0 ${valResult.ok ? "bg-green-400/5 border border-green-400/10 text-green-400/80" : "bg-red-400/5 border border-red-400/10 text-red-400/80"}`}>
                  <div className="flex items-center justify-between mb-1"><span className="font-semibold">{valResult.ok ? "✅ 一切正常" : `❌ ${valResult.errors.length} 个错误`}</span><button onClick={() => setValResult(null)} className="text-gray-500 hover:text-white">✕</button></div>
                  {valResult.errors.map((e, i) => <div key={i} className="text-red-400/70">· {e}</div>)}
                </div>
              )}

              {/* Gen log */}
              {genLog && (
                <div className="mx-4 mb-2 p-3 rounded-lg bg-black/40 border border-white/5 max-h-28 overflow-y-auto shrink-0">
                  <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap">{genLog}</pre>
                </div>
              )}

              {/* Bottom toolbar */}
              <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-t border-white/5 bg-[#0a0f18]">
                <button onClick={handleGenerate} disabled={genRunning} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/15 text-primary-light text-sm font-medium hover:bg-primary/25 disabled:opacity-50">
                  {genRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} AI 生成素材
                </button>
                <button onClick={() => { loadDetail(selected!); loadProjects(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5">
                  <RefreshCw className="h-3 w-3" /> 刷新
                </button>
                <div className="flex-1" />
              </div>
            </>
          )}
        </div>
      </div>

      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} onCreated={() => { loadProjects(); }} />
    </div>
  );
}
