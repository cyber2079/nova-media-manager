import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Play, Package, Eye, RefreshCw,
  CheckCircle, Clock, XCircle, AlertCircle, Loader2,
  Image, Video, Music, FolderOpen,
} from "lucide-react";
import NewProjectDialog from "@/components/studio/NewProjectDialog";
import SceneEditor from "@/components/studio/SceneEditor";

interface ThemeProject {
  id: string; name: string; version: string; themeType: string;
  status: string; requiresLicense: string; description?: string;
  sceneCount: number; doneCount: number; assetCount: number; totalAssetBytes: number;
}

interface ThemeScene {
  id: string; status: string; sceneType: string; promptKey: string;
  description?: string; assetPath?: string; thumbnailExists: boolean;
  assetSize: number; promptPreview: string;
}

interface ThemeDetail {
  manifest: any;
  prompts: any;
  scenes: ThemeScene[];
  assets: string[];
}

const STATUS: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  done: { icon: CheckCircle, color: "text-green-400", label: "完成" },
  todo: { icon: Clock, color: "text-gray-500", label: "待生成" },
  skip: { icon: XCircle, color: "text-gray-600", label: "跳过" },
};
const TYPEL: Record<string, string> = { story: "🎬 剧情", dynamic: "❄️ 动态", static: "🏠 静态", hybrid: "🔀 混合" };

export default function ThemeStudioPage() {
  const nav = useNavigate();
  const [projects, setProjects] = useState<ThemeProject[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThemeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [genLog, setGenLog] = useState("");
  const [genRunning, setGenRunning] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingScene, setEditingScene] = useState<ThemeScene | null>(null);
  const [validating, setValidating] = useState(false);
  const [valResult, setValResult] = useState<{ ok: boolean; errors: string[]; warnings: string[] } | null>(null);

  const loadProjects = useCallback(async () => {
    try { setProjects(await invoke<ThemeProject[]>("theme_studio_list_projects")); } catch {}
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    try { setDetail(await invoke<ThemeDetail>("theme_studio_get_project", { themeId: id })); setSelected(id); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => {
    if (projects.length > 0 && !selected) loadDetail(projects[0].id);
    else if (projects.length === 0) { setSelected(null); setDetail(null); }
  }, [projects, selected, loadDetail]);

  const pct = detail?.scenes.length
    ? Math.round((detail.scenes.filter(s => s.status === "done").length / detail.scenes.length) * 100) : 0;

  const handleGenerate = async () => {
    if (!selected) return;
    setGenRunning(true); setGenLog("");
    try { setGenLog(await invoke<string>("theme_studio_generate", { themeId: selected })); }
    catch (e: any) { setGenLog(e.toString()); }
    setGenRunning(false);
    loadDetail(selected);
    loadProjects();
  };

  const handleSaveScene = async (sceneId: string, data: any, promptUpdate?: any) => {
    if (!selected || !detail) return;
    const m = { ...detail.manifest };
    const scenes = [...(m.scenes || [])];
    const idx = scenes.findIndex((s: any) => s.id === sceneId);
    if (idx >= 0) scenes[idx] = { ...scenes[idx], ...data };
    m.scenes = scenes;

    let prompts = detail.prompts;
    if (promptUpdate) {
      prompts = { ...prompts };
      const pk = data.promptKey || sceneId;
      if (prompts.scenes?.[pk]) prompts.scenes[pk] = { ...prompts.scenes[pk], ...promptUpdate };
      else if (prompts.faces?.[pk.replace("face-", "")]) prompts.faces[pk.replace("face-", "")] = { ...prompts.faces[pk.replace("face-", "")], ...promptUpdate };
    }

    try {
      await invoke("theme_studio_update_manifest", { themeId: selected, manifest: m, prompts });
      loadDetail(selected);
    } catch (e: any) { alert(e.toString()); }
  };

  const handleValidate = async () => {
    if (!selected) return;
    setValidating(true);
    try { setValResult(await invoke("theme_studio_validate", { themeId: selected })); } catch {}
    setValidating(false);
  };

  return (
    <div className="h-screen bg-[#080c14] flex flex-col text-white select-none">
      {/* ── Top Bar ── */}
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0a0f18]">
        <button onClick={() => nav("/")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> 返回
        </button>
        <div className="w-px h-5 bg-white/10" />
        {detail ? (
          <>
            <span className="text-sm font-bold text-white">{detail.manifest.name}</span>
            <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">v{detail.manifest.version}</span>
            <span className="text-[10px] text-gray-400">{TYPEL[detail.manifest.type]}</span>
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
              detail.manifest.status === "packaged" ? "bg-green-400/15 text-green-400"
                : detail.manifest.status === "draft" ? "bg-yellow-400/15 text-yellow-400"
                : "bg-blue-400/15 text-blue-400"}`}>{detail.manifest.status}</span>
            <div className="flex-1" />
            <button onClick={handleValidate} disabled={validating}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}
              检查
            </button>
            <button onClick={() => setShowPreview(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <Eye className="h-3 w-3" /> 预览
            </button>
            <button disabled={genRunning}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors disabled:opacity-50">
              <Package className="h-3 w-3" /> 打包
            </button>
          </>
        ) : (
          <div className="flex-1 text-sm text-gray-500">选择一个主题项目，或创建新的</div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Project List */}
        <div className="w-52 shrink-0 border-r border-white/5 bg-[#0a0f18]/50 flex flex-col">
          <div className="px-3 py-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">主题项目</span>
            <button onClick={() => setShowNew(true)} className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/5"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {projects.map(p => (
              <button key={p.id} onClick={() => loadDetail(p.id)}
                className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2 text-sm ${
                  selected === p.id ? "bg-primary/10 text-primary-light border-l-2 border-primary-light" : "text-gray-400 hover:text-white border-l-2 border-transparent"
                }`}>
                <span className="text-base shrink-0">{p.themeType === "story" ? "🎬" : p.themeType === "dynamic" ? "❄️" : p.themeType === "static" ? "🏠" : "🔀"}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-medium">{p.name}</div>
                  <div className="text-[10px] text-gray-600">{p.doneCount}/{p.sceneCount} done · v{p.version}</div>
                </div>
              </button>
            ))}
            {projects.length === 0 && (
              <p className="px-3 py-6 text-xs text-gray-600 text-center leading-relaxed">
                尚无主题项目<br />
                <button onClick={() => setShowNew(true)} className="text-primary-light/70 hover:text-primary-light mt-1">+ 创建第一个</button>
              </p>
            )}
          </div>
          {selected && (
            <div className="px-3 py-2 border-t border-white/5 text-[10px] text-gray-600">
              素材: {detail?.assets.length || 0} 文件
              {detail?.manifest.assetsDir && <div className="truncate mt-0.5">{detail.manifest.assetsDir}</div>}
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {!detail ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "选择左侧主题项目"}
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="px-5 py-3 border-b border-white/5 shrink-0">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>素材进度</span>
                  <span>{detail.scenes.filter(s => s.status === "done").length}/{detail.scenes.length} · {pct}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Validation result */}
              {valResult && (
                <div className={`mx-5 mt-3 p-3 rounded-lg text-xs shrink-0 ${valResult.ok ? "bg-green-400/5 border border-green-400/10 text-green-400/80" : "bg-red-400/5 border border-red-400/10 text-red-400/80"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{valResult.ok ? "✅ 一切正常" : `❌ ${valResult.errors.length} 个错误`}</span>
                    <button onClick={() => setValResult(null)} className="text-gray-500 hover:text-white">✕</button>
                  </div>
                  {valResult.errors.map((e, i) => <div key={i} className="text-red-400/70">· {e}</div>)}
                  {valResult.warnings.map((w, i) => <div key={i} className="text-yellow-400/70">⚠ {w}</div>)}
                </div>
              )}

              {/* Scene Grid */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-4 gap-3">
                  {detail.scenes.map(scene => {
                    const info = STATUS[scene.status] || STATUS.todo;
                    const Icon = info.icon;
                    const isDone = scene.status === "done";
                    return (
                      <div
                        key={scene.id}
                        onClick={() => setEditingScene(scene)}
                        onDoubleClick={() => setEditingScene(scene)}
                        className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.02] group ${
                          isDone ? "border-green-400/20 bg-green-400/3" : "border-white/5 bg-white/[0.02]"
                        }`}
                      >
                        {/* Thumbnail area */}
                        <div className={`aspect-video flex items-center justify-center text-3xl ${
                          isDone ? "bg-black/30" : "bg-black/20"
                        }`}>
                          {scene.sceneType === "video" ? <Video className={`h-6 w-6 ${isDone ? "text-green-400/40" : "text-gray-700"}`} />
                            : scene.sceneType === "audio" ? <Music className={`h-6 w-6 ${isDone ? "text-green-400/40" : "text-gray-700"}`} />
                            : <Image className={`h-6 w-6 ${isDone ? "text-green-400/40" : "text-gray-700"}`} />}
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="text-[10px] text-white font-medium">双击编辑</span>
                        </div>

                        {/* Info bar */}
                        <div className="px-2.5 py-2 flex items-center gap-1.5">
                          <Icon className={`h-3 w-3 shrink-0 ${info.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium text-white truncate">{scene.description || scene.id}</div>
                            <div className="text-[9px] text-gray-600 font-mono truncate">{scene.promptKey}</div>
                          </div>
                          {isDone && scene.assetSize > 0 && (
                            <span className="text-[9px] text-gray-600 shrink-0">{(scene.assetSize / 1024).toFixed(0)}K</span>
                          )}
                        </div>

                        {/* Status dot */}
                        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isDone ? "bg-green-400" : scene.status === "todo" ? "bg-gray-600" : "bg-gray-700"}`} />
                      </div>
                    );
                  })}
                  {detail.scenes.length === 0 && (
                    <div className="col-span-4 py-20 text-center text-sm text-gray-600">
                      暂无场景定义 · 在 manifest.json 中设置 scenes 数组
                    </div>
                  )}
                </div>
              </div>

              {/* Generation log */}
              {genLog && (
                <div className="mx-5 mb-3 p-3 rounded-lg bg-black/40 border border-white/5 max-h-32 overflow-y-auto shrink-0">
                  <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap">{genLog}</pre>
                </div>
              )}

              {/* Bottom bar */}
              <div className="h-12 shrink-0 flex items-center gap-2 px-5 border-t border-white/5 bg-[#0a0f18]">
                <button onClick={handleGenerate} disabled={genRunning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/15 text-primary-light text-sm font-medium hover:bg-primary/25 transition-colors disabled:opacity-50">
                  {genRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  AI 生成素材
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-gray-600 font-mono">D:\nova-themes-assets\{selected}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} onCreated={() => { loadProjects(); if (!selected) loadDetail(projects[0]?.id); }} />
      <SceneEditor
        open={!!editingScene}
        scene={editingScene}
        prompts={detail?.prompts}
        globalStyle={detail?.prompts?.global?.style || ""}
        onClose={() => setEditingScene(null)}
        onSave={handleSaveScene}
        onGenerateOne={async (pk) => { setGenLog(`正在生成 ${pk}...`); handleGenerate(); }}
      />
      {/* Preview overlay — minimal */}
      {showPreview && detail && (
        <div className="fixed inset-0 z-[400] bg-[#080c14] flex flex-col">
          <div className="h-12 flex items-center px-4 border-b border-white/5">
            <button onClick={() => setShowPreview(false)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> 退出预览
            </button>
            <div className="flex-1 text-center text-sm font-bold text-white">{detail.manifest.name} · 预览</div>
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-500 text-6xl">
            预览模式将在主题运行时生效
          </div>
        </div>
      )}
    </div>
  );
}
