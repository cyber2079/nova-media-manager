import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderOpen, Image, RotateCcw, Trash2 } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { ThemeCharacter } from "@/stores/themeShortcutStore";
import { readFileSafe } from "@/lib/readFileSafe";

// Read local file into Blob URL for display
async function fileToBlobUrl(filePath: string): Promise<string | null> {
  try {
    const data = await readFileSafe(filePath);
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

interface Props {
  open: boolean;
  character: ThemeCharacter | null;
  onClose: () => void;
  onSave: (id: string, override: {
    name?: string;
    subtitle?: string;
    customIconPath?: string;
    appPath?: string;
  }) => void;
  onReset: (id: string) => void;
  onPickApp: () => Promise<string | null>;
  onPickIcon: () => Promise<string | null>;
}

export default function ThemeShortcutEditDialog({
  open,
  character,
  onClose,
  onSave,
  onReset,
  onPickApp,
  onPickIcon,
}: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [appPath, setAppPath] = useState("");
  const [customIconPath, setCustomIconPath] = useState("");
  const [iconSrc, setIconSrc] = useState("");
  const [iconIsCustom, setIconIsCustom] = useState(false);
  const [hasApp, setHasApp] = useState(false);
  const lastCharId = useRef<string | null>(null);
  const iconBlobRef = useRef<string | null>(null);

  // Release old blob
  function clearIconBlob() {
    if (iconBlobRef.current) {
      URL.revokeObjectURL(iconBlobRef.current);
      iconBlobRef.current = null;
    }
  }

  // Cleanup on unmount
  useEffect(() => () => clearIconBlob(), []);

  // Initialize form when a different character opens
  useEffect(() => {
    if (!character || character.id === lastCharId.current) return;
    lastCharId.current = character.id;
    clearIconBlob();

    setName(t(character.name));
    setSubtitle(t(character.subtitle));
    setAppPath(character.appPath);
    setHasApp(!!character.appPath);

    const isCustom = character.isCustom &&
      (character.iconPath !== "" && !character.iconPath.includes("/themes/"));
    setIconIsCustom(isCustom);

    if (isCustom && character.iconPath) {
      setCustomIconPath(character.iconPath);
      fileToBlobUrl(character.iconPath).then((url) => {
        if (url) { iconBlobRef.current = url; setIconSrc(url); }
      });
    } else {
      setCustomIconPath("");
      setIconSrc(character.iconPath || "");
    }
  }, [character]);

  async function handlePickIcon() {
    const p = await onPickIcon();
    if (p) {
      clearIconBlob();
      setCustomIconPath(p);
      setIconIsCustom(true);
      const url = await fileToBlobUrl(p);
      if (url) { iconBlobRef.current = url; setIconSrc(url); }
    }
  }

  async function handlePickApp() {
    const p = await onPickApp();
    if (p) {
      setAppPath(p);
      setHasApp(true);
    }
  }

  function handleClearApp() {
    setAppPath("");
    setHasApp(false);
  }

  function handleClearIcon() {
    clearIconBlob();
    setCustomIconPath("");
    setIconIsCustom(false);
    setIconSrc("");
  }

  function handleSave() {
    if (!character) return;
    const override: Record<string, string> = {};

    // Only include fields that changed
    if (name !== t(character.name)) override.name = name || "";
    if (subtitle !== t(character.subtitle)) override.subtitle = subtitle || "";

    // App path
    const origApp = character.appPath || "";
    if (appPath !== origApp) override.appPath = appPath;

    // Icon: if user picked a new one, pass it; if cleared, pass empty; otherwise omit
    if (customIconPath) {
      override.customIconPath = customIconPath;
    } else if (iconIsCustom === false && character.isCustom && character.appPath === appPath) {
      // User explicitly cleared icon (and didn't change app) — signal removal
      override.customIconPath = "";
    }

    if (Object.keys(override).length === 0) {
      onClose();
      return;
    }

    onSave(character.id, override as Parameters<typeof onSave>[1]);
    onClose();
  }

  function handleReset() {
    if (!character) return;
    onReset(character.id);
    lastCharId.current = null; // force re-init on next open
    onClose();
  }

  if (!character) return null;

  const fileName = appPath ? appPath.split(/[/\\]/).pop() || "" : "";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("shortcut.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-w-0">
          {/* Icon preview */}
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 cursor-pointer transition-all hover:border-primary-light",
                !iconSrc && "border-dashed border-primary"
              )}
              onClick={handlePickIcon}
              title={t("shortcut.click_change_icon")}
            >
              {iconSrc ? (
                <img src={iconSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <NeonIcon name="Image" size={16}><Image className="h-6 w-6 text-gray-500" /></NeonIcon>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Button variant="outline" size="sm" onClick={handlePickIcon} className="gap-1">
                <NeonIcon name="Image" size={16}><Image className="h-3.5 w-3.5" /></NeonIcon> {t("shortcut.change_icon")}
              </Button>
              {iconIsCustom && (
                <Button variant="ghost" size="sm" onClick={handleClearIcon} className="gap-1 text-gray-400">
                  <NeonIcon name="RotateCcw" size={16}><RotateCcw className="h-3.5 w-3.5" /></NeonIcon> {t("shortcut.restore_default")}
                </Button>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t("shortcut.name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("shortcut.name_placeholder")} />
          </div>

          {/* Subtitle */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t("shortcut.subtitle")}</label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={t("shortcut.subtitle_placeholder")} />
          </div>

          {/* App path */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t("shortcut.app_path")}</label>
            <div className="flex gap-2 min-w-0">
              <Input
                value={fileName}
                readOnly
                placeholder={t("shortcut.not_set")}
                className="flex-1 min-w-0 w-0 text-xs cursor-default overflow-hidden text-ellipsis whitespace-nowrap"
              />
              <Button variant="outline" size="sm" onClick={handlePickApp} className="gap-1 shrink-0">
                <NeonIcon name="FolderOpen" size={16}><FolderOpen className="h-3.5 w-3.5" /></NeonIcon> {t("shortcut.browse")}
              </Button>
              {hasApp && (
                <Button variant="ghost" size="icon" onClick={handleClearApp} className="shrink-0 text-gray-400">
                  <NeonIcon name="Trash2" size={16}><Trash2 className="h-3.5 w-3.5" /></NeonIcon>
                </Button>
              )}
            </div>
            {appPath && (
              <p className="text-[10px] text-gray-500 mt-1 truncate" title={appPath}>{appPath}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t border-primary">
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-gray-400 gap-1">
              <NeonIcon name="RotateCcw" size={16}><RotateCcw className="h-3.5 w-3.5" /></NeonIcon> {t("shortcut.reset_default")}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>{t("shortcut.cancel")}</Button>
              <Button size="sm" onClick={handleSave}>{t("shortcut.save")}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
