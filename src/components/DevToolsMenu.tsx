import { useState, useRef, useEffect } from "react";
import { Bug, Wrench, Image, Terminal, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const entries = [
  {
    label: "NV3D 管线",
    icon: <Image className="h-4 w-4" />,
    desc: "node pipeline.mjs — 素材校验 / manifest / 打包 / 签名",
    children: [
      { label: "环境校验", desc: "Node.js / basisu KT1X2 / gltf-transform Draco", cmd: "node scripts/webgl3d/pipeline.mjs --source ../../nova-themes-assets/webgl3d/{theme} --steps env" },
      { label: "素材校验", desc: "命名 / 分辨率 / manifest JSON / i18n", cmd: "node scripts/webgl3d/pipeline.mjs --source ../../nova-themes-assets/webgl3d/{theme} --steps validate" },
      { label: "生成 Manifest", desc: "扫描源目录 → SHA256 → manifest.json", cmd: "node scripts/webgl3d/pipeline.mjs --source ../../nova-themes-assets/webgl3d/{theme} --theme-id {theme} --steps manifest" },
      { label: "打包 .nv3d", desc: "manifest + 源文件 → 二进制 NV3D", cmd: "node scripts/webgl3d/pipeline.mjs --source ../../nova-themes-assets/webgl3d/{theme} --steps pack" },
      { label: "Ed25519 签名", desc: "Node 22 Web Crypto（需要 --sign-key）", cmd: "node scripts/webgl3d/pipeline.mjs --source ../../nova-themes-assets/webgl3d/{theme} --steps sign --sign-key <私钥路径>" },
      { label: "全管线 (env→pack)", desc: "env + validate + manifest + pack 一键", cmd: "node scripts/webgl3d/pipeline.mjs --source ../../nova-themes-assets/webgl3d/{theme} --theme-id {theme} --steps env,validate,manifest,pack" },
    ],
  },
];

export default function DevToolsMenu() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 active:scale-90",
        open ? "bg-cyan-500/20 text-cyan-400" : "hover:bg-surface-lighter text-gray-400 hover:text-cyan-400",
      )} title="3D 开发工具">
        <Bug className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl z-[200] overflow-hidden max-h-[70vh] overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2 sticky top-0 bg-black/95 z-10">
            <Wrench className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-400 tracking-wide">WebGL 3D 开发工具</span>
          </div>

          {entries.map((e, i) => {
            const isOpen = expanded === e.label;
            return (
              <div key={i} className="border-b border-white/5">
                <button
                  type="button"
                  className="w-full flex items-start gap-3 px-3 py-3 hover:bg-white/5 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : e.label)}
                >
                  <div className="shrink-0 mt-0.5 text-gray-400">{e.icon}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-200">{e.label}</span>
                    <p className="text-[11px] text-gray-500 mt-0.5">{e.desc}</p>
                  </div>
                  <span className="text-gray-500 mt-0.5">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                </button>

                {isOpen && e.children?.map((child, j) => (
                  <div key={j} className="pl-10 pr-3 pb-3 pt-1">
                    <div className="flex items-start gap-2">
                      <Terminal className="h-3.5 w-3.5 text-gray-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-300 font-medium">{child.label}</span>
                        <p className="text-[10px] text-gray-500 mt-0.5">{child.desc}</p>
                        <code className="block mt-1.5 px-2 py-1.5 rounded bg-white/5 text-[10px] text-gray-400 font-mono break-all select-all leading-relaxed">{child.cmd}</code>
                        <button
                          type="button"
                          className="mt-1 text-[10px] text-cyan-500 hover:text-cyan-400 transition"
                          onClick={() => { navigator.clipboard.writeText(child.cmd).catch(() => {}); setCopiedCmd(child.cmd); setTimeout(() => setCopiedCmd(null), 1500); }}
                        >
                          {copiedCmd === child.cmd ? "已复制 ✓" : "复制到剪贴板"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div className="px-3 py-2 border-t border-white/10 text-[10px] text-gray-600 bg-black/95">
            仅开发环境可见 · 生产构建不打包
          </div>
        </div>
      )}
    </div>
  );
}
