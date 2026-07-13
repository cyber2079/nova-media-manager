import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Plus, Play, Package, Eye, RefreshCw,
  CheckCircle, Clock, XCircle, AlertCircle, Loader2,
  Image, Video, Music, ChevronUp, ChevronDown, Trash2, GripVertical,
} from "lucide-react";
import NewProjectDialog from "@/components/studio/NewProjectDialog";

interface ThemeProject {
  id: string; name: string; version: string; themeType: string;
  status: string; requiresLicense: string; description?: string;
  assetCount: number; doneCount: number; scriptNodeCount: number; totalAssetBytes: number;
}

interface ScriptNode {
  id: string; label: string; background: string; face: string; text: string; bgm: string;
  skillShow: bool; thumbOk: bool; thumbUrl: string; thumbSize: number;
  i18nPreview: string; faceOk: bool; faceUrl: string;
}

interface AssetItem {
  id: string; status: string; assetType: string; path: string; description: string;
  exists: bool; thumbUrl: string; size: number;
}

interface ThemeDetail {
  manifest: any; prompts: any; script: ScriptNode[]; assets: AssetItem[];
  typeDescription: string;
}

const TYPEL: Record<string, { emoji: string; label: string }> = {
  story: { emoji: "🎬", label: "剧情" }, dynamic: { emoji: "❄️", label: "动态" },
  static: { emoji: "🏠", label: "静态" }, hybrid: { emoji: "🔀", label: "混合" },
};

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
  const [showPreview, setShowPreview] = useState(false);
  const [validating, setValidating] = useState(false);
  const [valResult, setValResult] = useState<{ ok: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [tab, setTab] = useState<"script" | "assets">("script");
  const [editingNode, setEditingNode] = useState<ScriptNode | null>(null);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const loadProjects = useCallback(async () => {
    try { setProjects(await invoke<ThemeProject[]>("theme_studio_list_projects")); } catch {}
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true); setImgErrors(new Set());
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

  return (
    <div className="h-screen bg-[#080c14] flex flex-col text-white select-none">
      {/* ── Top Bar ── */}
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0a0f18]">
        <button onClick={() => nav("/")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> 返回</button>
        {detail ? (
          <>
            <div className="w-px h-5 bg-white/10" />
            <span className="text-sm font-bold text-white">{detail.manifest.name}</span>
            <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">v{detail.manifest.version}</span>
            <span className="text-[11px] text-gray-400">{TYPEL[detail.manifest.type]?.emoji} {themeTypeName}</span>
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${detail.manifest.status === "packaged" ? "bg-green-400/15 text-green-400" : detail.manifest.status === "draft" ? "bg-yellow-400/15 text-yellow-400" : "bg-blue-400/15 text-blue-400"}`}>{detail.manifest.status}</span>
            <span className="hidden lg:inline text-[11px] text-gray-600 italic truncate">{detail.typeDescription}</span>
            <div className="flex-1" />
            <button onClick={handleValidate} disabled={validating} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5">
              {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}检查
            </button>
            <button onClick={() => setShowPreview(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5">
              <Eye className="h-3 w-3" /> 预览
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
        {/* Left: Project List */}
        <div className="w-52 shrink-0 border-r border-white/5 bg-[#0a0f18]/50 flex flex-col">
          <div className="px-3 py-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">主题项目</span>
            <button onClick={() => setShowNew(true)} className="text-gray-400 hover:text-white p-0.5 hover:bg-white/5"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {projects.map(p => (
              <button key={p.id} onClick={() => { loadDetail(p.id); setTab("script"); }}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm ${selected === p.id ? "bg-primary/10 text-primary-light border-l-2 border-primary-light" : "text-gray-400 hover:text-white border-l-2 border-transparent"}`}>
                <span className="text-base shrink-0">{TYPEL[p.themeType]?.emoji ?? "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-medium">{p.name}</div>
                  <div className="text-[10px] text-gray-600">{TYPEL[p.themeType]?.label} · {p.scriptNodeCount}节点 · v{p.version}</div>
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
              <div className="flex items-center gap-0 px-5 border-b border-white/5 shrink-0 bg-[#0a0f18]/80">
                <button onClick={() => setTab("script")} className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === "script" ? "border-primary-light text-primary-light" : "border-transparent text-gray-400 hover:text-white"}`}>
                  场景脚本 ({detail.script.length})
                </button>
                <button onClick={() => setTab("assets")} className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === "assets" ? "border-primary-light text-primary-light" : "border-transparent text-gray-400 hover:text-white"}`}>
                  素材清单 ({detail.assets.length})
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-gray-600">{doneCount}/{detail.assets.length} 素材就绪 · 脚本覆盖率 {scriptPct}%</span>
              </div>

              {/* Script Tab — timeline view */}
              {tab === "script" && (
                <div className="flex-1 overflow-y-auto p-4">
                  {detail.script.length === 0 ? (
                    <div className="text-center py-16 text-gray-600">
                      <div className="text-4xl mb-3">📝</div>
                      <p className="text-sm">暂无场景脚本</p>
                      <p className="text-xs mt-1">在 assets 已有素材后，回到脚本视图添加节点</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.script.map((node, idx) => {
                        const hasErr = imgErrors.has(node.id);
                        return (
                          <div key={node.id} className="flex items-stretch gap-2 group">
                            {/* Number */}
                            <div className="w-8 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-gray-500">{idx + 1}</span>
                            </div>

                            {/* Card */}
                            <div className={`flex-1 rounded-xl border transition-all hover:scale-[1.005] ${node.thumbOk ? "border-green-400/20 bg-green-400/3" : "border-white/5 bg-white/[0.02]"}`}>
                              <div className="flex items-stretch">
                                {/* Thumbnail */}
                                <div className="w-48 shrink-0 aspect-video relative flex items-center justify-center bg-black/20 rounded-l-xl overflow-hidden">
                                  {node.thumbOk && !hasErr ? (
                                    <img src={`/${node.thumbUrl}`} alt={node.label} className="absolute inset-0 w-full h-full object-cover" onError={() => imgError(node.id)} />
                                  ) : (
                                    <Image className="h-5 w-5 text-gray-700" />
                                  )}
                                  <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${node.thumbOk ? "bg-green-400" : "bg-gray-600"}`} />
                                </div>

                                {/* Info */}
                                <div className="flex-1 px-3 py-2.5 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[11px] font-bold text-white">{node.label || node.id}</span>
                                    {node.skillShow && <span className="text-[8px] bg-purple-400/20 text-purple-400 px-1 rounded">技能展示</span>}
                                  </div>
                                  <div className="text-[9px] text-gray-600 font-mono truncate">🎞 {node.background || "(默认背景)"}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {node.face && (
                                      <span className="text-[9px] text-gray-500 flex items-center gap-1">
                                        {node.face.startsWith("video:") ? "🎥" : "😶"} {node.face}
                                        {node.faceOk && <CheckCircle className="h-2 w-2 text-green-400" />}
                                      </span>
                                    )}
                                    {node.bgm && <span className="text-[9px] text-gray-500">♪ {node.bgm}</span>}
                                    {node.i18nPreview && <span className="text-[9px] text-accent/60 font-mono">{node.i18nPreview}</span>}
                                  </div>
                                </div>

                                {/* Controls */}
                                <div className="flex flex-col justify-center gap-0.5 px-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="p-0.5 text-gray-400 hover:text-white"><ChevronUp className="h-3 w-3" /></button>
                                  <button className="p-0.5 text-gray-400 hover:text-white"><ChevronDown className="h-3 w-3" /></button>
                                  <button className="p-0.5 text-gray-400 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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

              {/* Gen log */}
              {genLog && (
                <div className="mx-4 mb-3 p-3 rounded-lg bg-black/40 border border-white/5 max-h-28 overflow-y-auto shrink-0">
                  <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap">{genLog}</pre>
                </div>
              )}

              {/* Bottom bar */}
              <div className="h-12 shrink-0 flex items-center gap-2 px-5 border-t border-white/5 bg-[#0a0f18]">
                <button onClick={handleGenerate} disabled={genRunning} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/15 text-primary-light text-sm font-medium hover:bg-primary/25 disabled:opacity-50">
                  {genRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} AI 生成
                </button>
                <button onClick={() => { loadDetail(selected!); loadProjects(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5">
                  <RefreshCw className="h-3 w-3" /> 刷新
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-gray-600 font-mono hidden lg:inline">public/themes/{selected === "ice-girl" ? "ice girl" : selected === "cyber-girl" ? "cyber girl" : selected}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} onCreated={() => { loadProjects(); }} />
      {/* Preview overlay */}
      {showPreview && detail && (
        <div className="fixed inset-0 z-[400] bg-[#080c14] flex flex-col">
          <div className="h-12 flex items-center px-4 border-b border-white/5">
            <button onClick={() => setShowPreview(false)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> 退出</button>
            <div className="flex-1 text-center text-sm font-bold text-white">{detail.manifest.name} · 预览</div>
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center"><div className="text-5xl mb-4">🚧</div><p className="text-sm">预览模式运行时生效</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
