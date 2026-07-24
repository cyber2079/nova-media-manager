import { useEffect, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Clipboard, FolderOpen, Info } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";

interface ContextMenuProps {
  show: boolean;
  x: number;
  y: number;
  filePath: string;
  onClose: () => void;
}

export default function ContextMenu({ show, x, y, filePath, onClose }: ContextMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onClick = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, [show, onClose]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(filePath);
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 800);
    } catch {}
  }, [filePath, onClose]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      // Use the existing launch_quick_item to open the parent folder
      // Actually, use shell:open to open explorer
      const dir = filePath.replace(/[/\\][^/\\]*$/, "");
      await invoke("launch_quick_item", { programPath: dir });
    } catch {}
    onClose();
  }, [filePath, onClose]);

  const handleProperties = useCallback(async () => {
    // Open file properties dialog via explorer /select
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_file_properties", { path: filePath });
    } catch {
      // Fallback: open containing folder with explorer
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("launch_quick_item", { programPath: "/select," + filePath });
      } catch {}
    }
    onClose();
  }, [filePath, onClose]);

  if (!show) return null;

  return (
    <div
      ref={ref}
      className="fixed z-[200] min-w-[160px] rounded-md border border-primary bg-surface-light/98 backdrop-blur-md shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={handleCopy} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-lighter hover:text-white transition-colors text-left">
        <NeonIcon name="Clipboard" size={16}><Clipboard className="h-3.5 w-3.5" /></NeonIcon>
        {copied ? t("music.copied") : t("music.copy_path")}
      </button>
      <button onClick={handleOpenFolder} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-lighter hover:text-white transition-colors text-left">
        <NeonIcon name="FolderOpen" size={16}><FolderOpen className="h-3.5 w-3.5" /></NeonIcon>
        {t("music.open_in_folder")}
      </button>
      <div className="h-px bg-surface-lighter my-1" />
      <button onClick={handleProperties} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-lighter hover:text-white transition-colors text-left">
        <NeonIcon name="Info" size={16}><Info className="h-3.5 w-3.5" /></NeonIcon>
        {t("music.properties")}
      </button>
    </div>
  );
}
