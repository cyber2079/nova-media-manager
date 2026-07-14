import { useEffect, useRef, useState, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore, type WallpaperConfig } from "@/stores/settingsStore";

/** Lists image files in a directory (Rust command). */
async function listImages(dir: string): Promise<string[]> {
  try {
    return await invoke<string[]>("wallpaper_list_images", { path: dir });
  } catch { return []; }
}

/** Slideshow engine: iterate images from a folder with optional shuffle */
function useFolderImages(path: string, shuffle: boolean, intervalSec: number): string | null {
  const [files, setFiles] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Load file list
  useEffect(() => {
    if (!path) { setFiles([]); return; }
    listImages(path).then(fs => {
      const pics = fs.filter(f => /\.(webp|jpg|jpeg|png|bmp|gif)$/i.test(f));
      setFiles(pics);
      setIndex(0);
    }).catch(() => setFiles([]));
  }, [path]);

  const advance = useCallback(() => {
    if (files.length === 0) return;
    setIndex(prev => {
      if (shuffle) {
        return Math.floor(Math.random() * files.length);
      }
      return (prev + 1) % files.length;
    });
  }, [files.length, shuffle]);

  // Interval
  useEffect(() => {
    if (files.length <= 1) return;
    const ms = Math.max(1, intervalSec) * 1000;
    timerRef.current = setInterval(advance, ms);
    return () => clearInterval(timerRef.current);
  }, [files.length, intervalSec, advance]);

  if (files.length === 0) return null;
  const file = files[index];
  if (!file) return null;
  // Convert file path to URL
  try { return convertFileSrc(file); } catch { return `asset://localhost/${file.replace(/\\/g, "/")}`; }
}

/** Full wallpaper rendering layer for default theme */
export default function WallpaperEngine() {
  const wp = useSettingsStore((s) => s.wallpaper);
  const [singleSrc, setSingleSrc] = useState<string | null>(null);
  const folderSrc = useFolderImages(
    wp.mode === "folder" ? wp.path : "",
    wp.shuffle === "random",
    wp.interval
  );

  // Single image mode
  useEffect(() => {
    if (wp.mode !== "single" || !wp.path) { setSingleSrc(null); return; }
    try {
      setSingleSrc(convertFileSrc(wp.path));
    } catch {
      setSingleSrc(`asset://localhost/${wp.path.replace(/\\/g, "/")}`);
    }
  }, [wp.mode, wp.path]);

  const src = wp.mode === "single" ? singleSrc : wp.mode === "folder" ? folderSrc : null;
  if (!src) return null;

  const objectFit: React.CSSProperties["objectFit"] = wp.fit || "none";
  const isNone = wp.fit === "none";
  return (
    <>
      <img
        key={`${wp.fit}-${src.slice(-20)}`}
        src={src}
        alt=""
        className={`fixed z-0 pointer-events-none ${isNone
          ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[100vw] max-h-[100vh]"
          : "inset-0 w-full h-full"}`}
        style={{
          objectFit,
          opacity: `var(--bg-opacity, 0.7)`,
          transition: "opacity 1s ease",
        }}
      />
      {/* Dark overlay to keep UI readable */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(8,12,20,0.55) 0%, rgba(8,12,20,0.3) 50%, rgba(8,12,20,0.55) 100%)",
        }}
      />
    </>
  );
}
