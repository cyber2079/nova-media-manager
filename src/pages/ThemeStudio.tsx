import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Plus, Play, Package, Eye, RefreshCw,
  CheckCircle, Clock, XCircle, AlertCircle, Loader2,
  Image, Video, Music,
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
  description: string; thumbnailUrl: string; thumbnailExists: boolean;
  assetSize: number; promptText: string; i18nKey: string;
}

interface ThemeDetail {
  manifest: any; prompts: any; scenes: ThemeScene[];
  assets: string[]; typeDescription: string;
}

const TYPEL: Record<string, { emoji: string; label: string }> = {
  story: { emoji: "🎬", label: "剧情" },
  dynamic: { emoji: "❄️", label: "动态" },
  static: { emoji: "🏠", label: "静态" },
  hybrid: { emoji: "🔀", label: "混合" },
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
  const [editingScene, setEditingScene] = useState<ThemeScene | null>(null);
  const [validating, setValidating] = useState(false);
  const [valResult, setValResult] = useState<{ ok: boolean; errors: string[]; warnings: string[] } | null>(null);
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

  const pct = detail?.scenes.length ? Math.round((detail.scenes.filter(s => s.status === "done" || s.thumbnailExists).length / detail.scenes.length) * 100) : 0;
  const doneCount = detail?.scenes.filter(s => s.status === "done" || s.thumbnailExists).length ?? 0;

  const handleGenerate = async () => {
    if (!selected) return;
    setGenRunning(true); setGenLog("⚡ 启动生成器...\n");
    try { const out = await invoke<string>("theme_studio_generate", { themeId: selected }); setGenLog(out); }
    catch (e: any) { setGenLog(`${genLog}\n❌ ${e.toString()}`); }
    setGenRunning(false);
    loadDetail(selected); loadProjects();
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
    try { await invoke("theme_studio_update_manifest", { themeId: selected, manifest: m, prompts }); loadDetail(selected); } catch (e: any) { alert(e); }
  };

  const handleValidate = async () => {
    if (!selected) return;
    setValidating(true);
    try { setValResult(await invoke("theme_studio_validate", { themeId: selected })); } catch {}
    setValidating(false);
  };

  function thumbUrl(p: string): string { return p ? `/${p}` : ""; }

  function imgError(id: string) { setImgErrors(prev => { const n = new Set(prev); n.add(id); return n; }); }

  const themeTypeName = detail?.manifest.type ? TYPEL[detail.manifest.type]?.label ?? detail.manifest.type : "";

  return (
    <div className="h-screen bg-[#080c14] flex flex-col text-white select-none">
      {/* ── Top Bar ── */}
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0a0f18]">
        <button onClick={() => nav("/")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> 返回
        </button>
        {detail ? (
          <>
            <div className="w-px h-5 bg-white/10" />
            <span className="text-sm font-bold text-white">{detail.manifest.name}</span>
            <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">v{detail.manifest.version}</span>
            <span className="text-[11px] text-gray-400">{TYPEL[detail.manifest.type]?.emoji} {themeTypeName}</span>
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
              detail.manifest.status === "packaged" ? "bg-green-400/15 text-green-400"
                : detail.manifest.status === "draft" ? "bg-yellow-400/15 text-yellow-400"
                : "bg-blue-400/15 text-blue-400"}`}>{detail.manifest.status}</span>
            <div className="flex-1" />
            <span className="hidden sm:inline text-[11px] text-gray-600 italic max-w-xs truncate">{detail.typeDescription}</span>
            <div className="flex-1" />
            <button onClick={handleValidate} disabled={validating}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}检查
            </button>
            <button onClick={() => setShowPreview(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <Eye className="h-3 w-3" /> 预览
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors">
              <Package className="h-3 w-3" /> 打包
            </button>
          </>
        ) : (
          <div className="flex-1 text-sm text-gray-500 flex items-center gap-2">
            选择一个主题项目，或
            <button onClick={() => setShowNew(true)} className="text-primary-light hover:underline">创建新的</button>
          </div>
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
                <span className="text-base shrink-0">{TYPEL[p.themeType]?.emoji ?? "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-medium">{p.name}</div>
                  <div className="text-[10px] text-gray-600">
                    {TYPEL[p.themeType]?.label ?? p.themeType} · v{p.version}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${p.sceneCount > 0 ? (p.doneCount / p.sceneCount) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-600 font-mono">{p.doneCount}/{p.sceneCount}</span>
                  </div>
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
              {detail?.assets.length ?? 0} 个素材文件 · {(detail?.scenes.filter(s => s.thumbnailExists).length ?? 0)} 已有
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#060b14]">
          {!detail ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "选择左侧主题项目"}
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="px-5 py-3 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                      <span>素材进度</span>
                      <span>{doneCount}/{detail.scenes.length} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400 italic max-w-md truncate hidden xl:inline">{detail.typeDescription}</span>
                </div>
              </div>

              {/* Validation */}
              {valResult && (
                <div className={`mx-5 mt-3 p-3 rounded-lg text-xs shrink-0 ${valResult.ok ? "bg-green-400/5 border border-green-400/10 text-green-400/80" : "bg-red-400/5 border border-red-400/10 text-red-400/80"}`}>
                  <div className="flex items-center justify-between mb-1"><span className="font-semibold">{valResult.ok ? "✅ 一切正常" : `❌ ${valResult.errors.length} 个错误`}</span><button onClick={() => setValResult(null)} className="text-gray-500 hover:text-white">✕</button></div>
                  {valResult.errors.map((e, i) => <div key={i} className="text-red-400/70">· {e}</div>)}
                  {valResult.warnings.map((w, i) => <div key={i} className="text-yellow-400/70">⚠ {w}</div>)}
                </div>
              )}

              {/* Scene Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-4 gap-3">
                  {detail.scenes.map(scene => {
                    const exists = scene.thumbnailExists;
                    const url = exists ? thumbUrl(scene.thumbnailUrl) : "";
                    const hasImgErr = imgErrors.has(scene.id);
                    const showImg = exists && url && !hasImgErr;
                    // i18n text for this scene
                    const i18nText = scene.i18nKey ? t(scene.i18nKey, "").slice(0, 80) : "";
                    const isStoryScene = detail.manifest.type === "story" && scene.id.startsWith("scene");

                    return (
                      <div
                        key={scene.id}
                        onClick={() => setEditingScene(scene)}
                        className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.02] group ${
                          exists ? "border-green-400/20" : "border-white/5"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className={`aspect-video flex items-center justify-center relative ${
                          exists ? "bg-black/30" : "bg-black/20"
                        }`}>
                          {showImg ? (
                            <img src={url} alt={scene.description}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={() => imgError(scene.id)} />
                          ) : exists && hasImgErr ? (
                            <Image className="h-6 w-6 text-green-400/40" />
                          ) : (
                            <>
                              {scene.sceneType === "video" ? <Video className="h-6 w-6 text-gray-700" />
                                : scene.sceneType === "audio" ? <Music className="h-6 w-6 text-gray-700" />
                                : <Image className="h-6 w-6 text-gray-700" />}
                            </>
                          )}
                          {/* Status dot */}
                          <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-black/20 ${
                            exists ? "bg-green-400" : scene.status === "todo" ? "bg-gray-600" : scene.status === "skip" ? "bg-gray-700" : "bg-gray-600"
                          }`} />
                          {/* Type badge */}
                          <span className="absolute top-1.5 left-1.5 text-[9px] bg-black/60 px-1.5 py-0.5 rounded">
                            {scene.sceneType === "video" ? "🎥" : scene.sceneType === "audio" ? "🔊" : "🖼️"}
                          </span>
                        </div>

                        {/* Info */}
                        <div className={`px-2.5 py-2 ${exists ? "bg-green-400/5" : ""}`}>
                          <div className="text-[11px] font-medium text-white truncate">
                            {scene.description || scene.id}
                          </div>
                          <div className="text-[9px] text-gray-500 font-mono truncate">
                            {scene.promptKey}
                            {exists && scene.assetSize > 0 && ` · ${(scene.assetSize / 1024).toFixed(0)}K`}
                          </div>
                          {/* i18n text preview */}
                          {i18nText && (
                            <div className="text-[9px] text-gray-500 mt-1 leading-relaxed line-clamp-2 italic">
                              💬 "{i18nText}"
                            </div>
                          )}
                          {/* Prompt preview */}
                          {scene.promptText && !i18nText && (
                            <div className="text-[9px] text-gray-600 mt-1 leading-relaxed line-clamp-2 font-mono">
                              🤖 {scene.promptText.slice(0, 100)}
                            </div>
                          )}
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] text-white font-medium">双击编辑</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Generation log */}
              {genLog && (
                <div className="mx-4 mb-3 p-3 rounded-lg bg-black/40 border border-white/5 max-h-32 overflow-y-auto shrink-0">
                  <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap">{genLog}</pre>
                </div>
              )}

              {/* Bottom bar */}
              <div className="h-13 shrink-0 flex items-center gap-2 px-5 py-2 border-t border-white/5 bg-[#0a0f18]">
                <button onClick={handleGenerate} disabled={genRunning}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary/15 text-primary-light text-sm font-medium hover:bg-primary/25 transition-colors disabled:opacity-50">
                  {genRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  AI 生成素材
                </button>
                <button onClick={async () => { if (selected) { loadDetail(selected); loadProjects(); } }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                  <RefreshCw className="h-3 w-3" /> 刷新
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-gray-600 font-mono hidden lg:inline">
                  public/themes/{selected ? (selected === "ice-girl" ? "ice girl" : selected === "cyber-girl" ? "cyber girl" : selected) : ""}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)}
        onCreated={() => { loadProjects(); if (selected) loadDetail(selected); }} />
      <SceneEditor open={!!editingScene} scene={editingScene}
        prompts={detail?.prompts}
        globalStyle={detail?.prompts?.global?.style || ""}
        onClose={() => setEditingScene(null)}
        onSave={handleSaveScene}
        onGenerateOne={async () => { handleGenerate(); setEditingScene(null); }} />

      {/* Preview overlay */}
      {showPreview && detail && (
        <div className="fixed inset-0 z-[400] bg-[#080c14] flex flex-col">
          <div className="h-12 flex items-center px-4 border-b border-white/5">
            <button onClick={() => setShowPreview(false)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> 退出预览
            </button>
            <div className="flex-1 text-center text-sm font-bold text-white">{detail.manifest.name} · 预览</div>
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">🚧</div>
              <p className="text-sm">预览模式将在主题运行时生效</p>
              <p className="text-xs text-gray-600 mt-1">场景数: {detail.scenes.length} · 已完成: {doneCount}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
