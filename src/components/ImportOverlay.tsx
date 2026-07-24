import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";

interface ImportOverlayProps {
  isOpen: boolean;
  message?: string;
}

/**
 * Fullscreen fade-in/fade-out loading overlay.
 * Blocks all interaction while a media import/scan is in progress.
 */
export function ImportOverlay({ isOpen, message }: ImportOverlayProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // trigger fade-in on the next frame so the CSS transition fires
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      // wait for the opacity transition to finish before unmounting
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-300 pointer-events-auto"
      style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <NeonIcon name="Loader2" size={16}><Loader2 className="h-10 w-10 animate-spin text-primary-light" /></NeonIcon>
        <p className="text-sm text-gray-300">{message ?? t("mediaScan.importing")}</p>
      </div>
    </div>,
    document.body,
  );
}
