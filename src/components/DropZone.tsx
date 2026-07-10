import { memo, useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onDrop: (paths: string[]) => void;
  accept?: string; // comma-separated extensions: ".mp4,.avi,.mkv"
  children?: React.ReactNode;
  className?: string;
}

export default memo(function DropZone({ onDrop, accept, children, className }: DropZoneProps) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const counter = useRef(0);

  const exts = (accept || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const matches = useCallback(
    (name: string) => {
      if (exts.length === 0) return true;
      const lower = name.toLowerCase();
      return exts.some((e) => lower.endsWith(e));
    },
    [exts]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    []
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current--;
    if (counter.current <= 0) {
      counter.current = 0;
      setDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      counter.current = 0;
      setDragging(false);

      const items = Array.from(e.dataTransfer.items || []);
      const paths: string[] = [];

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && matches(file.name)) {
            // Try to get the path from the File object
            const f = file as any;
            if (f.path) {
              paths.push(f.path);
            }
          }
        }
      }

      if (paths.length > 0) {
        onDrop(paths);
      }
    },
    [onDrop, matches]
  );

  // Reset counter on unmount
  useEffect(() => {
    return () => { counter.current = 0; };
  }, []);

  return (
    <div
      className={cn("relative", className)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {dragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary-light bg-primary/10 backdrop-blur-sm pointer-events-none animate-in fade-in duration-150">
          <div className="text-center">
            <p className="text-lg font-semibold text-primary-light">{t("music.drop_to_import")}</p>
            <p className="text-sm text-gray-400 mt-1">{t("music.drop_hint")}</p>
          </div>
        </div>
      )}
    </div>
  );
});

/** wrap a page with drop-to-import */
export function useDropImport(onDrop: (paths: string[]) => void, accept?: string) {
  return function DropImportWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
      <DropZone onDrop={onDrop} accept={accept} className={className}>
        {children}
      </DropZone>
    );
  };
}

