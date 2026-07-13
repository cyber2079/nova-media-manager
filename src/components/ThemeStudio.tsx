import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import {
  Palette, RefreshCw, Package, Play, Edit3, Plus,
  Image, Video, CheckCircle, Clock, AlertCircle, XCircle,
  Loader2, ExternalLink,
} from "lucide-react";

interface ThemeProject {
  id: string;
  name: string;
  version: string;
  themeType: string;
  status: string;
  requiresLicense: string;
  description?: string;
  sceneCount: number;
  doneCount: number;
  assetCount: number;
}

interface ThemeScene {
  id: string;
  status: string;
  sceneType: string;
  promptKey: string;
  description?: string;
  assetPath?: string;
  thumbnailExists: boolean;
}

interface ThemeDetail {
  manifest: any;
  prompts: any;
  scenes: ThemeScene[];
  assets: string[];
}

const STATUS_ICON: Record<string, typeof CheckCircle> = {
  done: CheckCircle,
  todo: Clock,
  generating: Loader2,
  skip: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  done: "text-green-400",
  todo: "text-gray-500",
  generating: "text-blue-400",
  skip: "text-gray-600",
};

const TYPE_LABEL: Record<string, string> = {
  story: "剧情",
  dynamic: "动态",
  static: "静态",
  hybrid: "混合",
};

export default function ThemeStudio() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ThemeProject[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThemeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [genLog, setGenLog] = useState("");
  const [genRunning, setGenRunning] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const list = await invoke<ThemeProject[]>("theme_studio_list_projects");
      setProjects(list);
    } catch (err) {
      console.error("[ThemeStudio] list failed:", err);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const d = await invoke<ThemeDetail>("theme_studio_get_project", { themeId: id });
      setDetail(d);
      setSelected(id);
    } catch (err) {
      console.error("[ThemeStudio] detail failed:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => {
    if (projects.length > 0 && !selected) {
      loadDetail(projects[0].id);
    }
  }, [projects, selected, loadDetail]);

  const progressPct = detail?.scenes.length
    ? Math.round((detail.scenes.filter(s => s.status === "done").length / detail.scenes.length) * 100)
    : 0;

  return (
    <div className="flex-1 flex min-h-0">
      {/* ── Left: Project List ── */}
      <div className="w-48 shrink-0 border-r border-white/5 py-2 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          主题项目
        </div>
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => loadDetail(p.id)}
            className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2 ${
              selected === p.id ? "bg-primary/15 text-primary-light" : "text-gray-400 hover:text-white hover:bg-surface-lighter"
            }`}
          >
            <span className="text-base">{p.themeType === "story" ? "🎬" : p.themeType === "dynamic" ? "❄️" : "🏠"}</span>
            <span className="flex-1 truncate">{p.name}</span>
            {p.doneCount > 0 && (
              <span className="text-[10px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded-full font-mono">
                {p.doneCount}
              </span>
            )}
          </button>
        ))}
        {projects.length === 0 && (
          <p className="px-3 py-4 text-xs text-gray-600">
            在 D:\nova-proprietary\themes\ 创建主题项目
          </p>
        )}
      </div>

      {/* ── Right: Detail Panel ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5">
        {!detail ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "选择左侧主题项目"}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white">{detail.manifest.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span className="font-mono bg-surface-lighter px-1.5 py-0.5 rounded">{detail.manifest.id}</span>
                  <span>v{detail.manifest.version}</span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-lighter">
                    {TYPE_LABEL[detail.manifest.type] || detail.manifest.type}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    detail.manifest.status === "packaged" ? "bg-green-400/15 text-green-400"
                      : detail.manifest.status === "published" ? "bg-blue-400/15 text-blue-400"
                      : "bg-yellow-400/15 text-yellow-400"
                  }`}>
                    {detail.manifest.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadDetail(selected!)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-surface-lighter transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> 刷新
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>素材进度</span>
                <span>{detail.scenes.filter(s => s.status === "done").length} / {detail.scenes.length} · {progressPct}%</span>
              </div>
              <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Scene Board */}
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
              场景/素材
            </h4>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {detail.scenes.map(scene => {
                const Icon = STATUS_ICON[scene.status] || Clock;
                const isDone = scene.status === "done";
                return (
                  <div
                    key={scene.id}
                    className={`rounded-xl border p-3 text-sm transition-all ${
                      isDone
                        ? "border-green-400/20 bg-green-400/5"
                        : "border-white/5 bg-surface-lighter/30"
                    }`}
                  >
                    {/* Thumbnail placeholder */}
                    <div className={`w-full aspect-video rounded-lg mb-2 flex items-center justify-center text-2xl ${
                      isDone ? "bg-surface-lighter/50" : "bg-surface-lighter/20"
                    }`}>
                      {scene.sceneType === "video" ? <Video className="h-5 w-5 text-gray-600" /> : <Image className="h-5 w-5 text-gray-600" />}
                    </div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon className={`h-3 w-3 ${STATUS_COLOR[scene.status]}`} />
                      <span className="text-xs font-medium text-white truncate">{scene.description || scene.id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span>{scene.sceneType === "video" ? "🎥" : "🖼️"}</span>
                      <span className="font-mono">{scene.promptKey}</span>
                      {isDone && <CheckCircle className="h-2.5 w-2.5 text-green-500" />}
                      {scene.status === "todo" && <Clock className="h-2.5 w-2.5 text-gray-500" />}
                    </div>
                  </div>
                );
              })}
              {detail.scenes.length === 0 && (
                <div className="col-span-4 py-8 text-center text-xs text-gray-600">
                  暂无场景定义。在 manifest.json 中设置 scenes 数组。
                </div>
              )}
            </div>

            {/* Assets */}
            {detail.assets.length > 0 && (
              <>
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  已生成素材 ({detail.assets.length})
                </h4>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {detail.assets.map(a => (
                    <span key={a} className="text-[10px] font-mono px-2 py-1 rounded bg-surface-lighter/50 text-gray-400 border border-white/5">
                      {a}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Generation Log */}
            {genLog && (
              <div className="mb-4 p-3 rounded-lg bg-black/30 border border-white/5 max-h-40 overflow-y-auto">
                <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap">{genLog}</pre>
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-auto flex items-center gap-2 pt-4 border-t border-white/5">
              <button
                onClick={async () => {
                  setGenRunning(true);
                  setGenLog("");
                  try {
                    const output = await invoke<string>("theme_studio_generate", { themeId: selected! });
                    setGenLog(output);
                  } catch (err: any) {
                    setGenLog(err.toString());
                  }
                  setGenRunning(false);
                  loadDetail(selected!);
                }}
                disabled={genRunning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary-light text-sm font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                {genRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                AI 生成素材
              </button>
              <span className="text-[10px] text-gray-600 font-mono px-3">
                D:\nova-themes-assets\{selected}
              </span>
              <div className="flex-1" />
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition-colors">
                <Package className="h-3.5 w-3.5" /> 打包发布
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
