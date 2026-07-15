import { useState, useEffect, useCallback } from "react";
import { Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import DesktopWidget from "@/components/DesktopWidget";
import FileExplorer from "@/components/FileExplorer";
import type { WidgetConfig } from "@/stores/widgetStore";

interface DiskInfo { disk: number; disk_used: number; disk_total: number; }

function formatDiskSize(bytes: number): string {
  if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(1) + " TB";
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
  return (bytes / 1048576).toFixed(0) + " MB";
}

async function fileToDataUrl(filePath: string): Promise<string | null> {
  try {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const data = await readFile(filePath);
    const ext = (filePath.split(".").pop() || "png").toLowerCase();
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon",
      bmp: "image/bmp", gif: "image/gif",
    };
    const blob = new Blob([data], { type: mimeMap[ext] || "image/png" });
    return URL.createObjectURL(blob);
  } catch { return null; }
}

export default function MyComputerWidget({ config }: { config: WidgetConfig }) {
  const { t } = useTranslation();
  const [iconSrc, setIconSrc] = useState("");
  const [disk, setDisk] = useState<DiskInfo>({ disk: 0, disk_used: 0, disk_total: 0 });
  const [explorerOpen, setExplorerOpen] = useState(false);

  const handleClick = async () => {
    const mode = config.myComputerMode || "default";
    if (mode === "custom") {
      setExplorerOpen(true);
    } else {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_my_computer");
      } catch { /* not in Tauri */ }
    }
  };

  const fetchDisk = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data = await invoke<DiskInfo>("get_system_info");
      setDisk(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchDisk();
    const t = setInterval(fetchDisk, 10000);
    return () => clearInterval(t);
  }, [fetchDisk]);

  useEffect(() => {
    if (config.iconPath) {
      fileToDataUrl(config.iconPath).then((url) => {
        if (url) setIconSrc(url);
      });
    } else {
      setIconSrc("");
    }
    return () => { if (iconSrc) URL.revokeObjectURL(iconSrc); };
  }, [config.iconPath]);

  return (
    <>
    <DesktopWidget position={config.position}>
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={handleClick}
          className="group flex flex-col items-center gap-1 pointer-events-auto"
          title={config.label}
        >
          {/* SVG outer ring */}
          <div className="relative">
            <svg width="100" height="100" viewBox="0 0 100 100" className="drop-shadow-lg pointer-events-none">
              <circle cx="50" cy="50" r={44} fill="none" stroke="var(--color-primary)" strokeOpacity="0.2" strokeWidth="1.5" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/30 bg-surface/40 backdrop-blur-md overflow-hidden
                transition-all duration-300 group-hover:border-primary/60 group-hover:shadow-lg group-hover:shadow-primary/20 group-hover:scale-105">
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="h-9 w-9 object-contain" />
                ) : (
                  <Monitor className="h-6 w-6 text-primary-light" style={{ filter: "brightness(1.2)" }} />
                )}
              </div>
            </div>
          </div>
          <span className="text-[10px] text-primary-light/70 font-medium tracking-wide max-w-[100px] truncate" style={{ filter: "brightness(1.2)" }}>
            {t("widget.my_computer", config.label)}
          </span>
        </button>
        {/* Disk usage bar */}
        {disk.disk > 0 && (
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${disk.disk}%`,
                  background: disk.disk > 80
                    ? "linear-gradient(90deg, var(--color-accent), #ff666680)"
                    : "linear-gradient(90deg, var(--color-primary-light), var(--color-primary))",
                }} />
            </div>
            <span className="text-[8px] tracking-wide"
              style={{
                color: disk.disk > 80 ? "rgba(255,136,136,0.7)" : "var(--color-primary-light)",
                filter: "brightness(1.2)",
              }}>
              C: {formatDiskSize(disk.disk_used)} / {formatDiskSize(disk.disk_total)}
            </span>
          </div>
        )}
      </div>
    </DesktopWidget>
    <FileExplorer open={explorerOpen} onClose={() => setExplorerOpen(false)} />
    </>
  );
}
