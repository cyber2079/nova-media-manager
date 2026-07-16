import { useEffect, useRef, useState, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";

async function listImages(dir: string): Promise<string[]> {
  try {
    return await invoke<string[]>("wallpaper_list_images", { path: dir });
  } catch {
    return [];
  }
}

function useFolderImages(path: string, shuffle: boolean, intervalSec: number): string | null {
  const [files, setFiles] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!path) {
      setFiles([]);
      return;
    }
    listImages(path).then(fs => {
      setFiles(fs.filter(f => /\.(webp|jpg|jpeg|png|bmp|gif)$/i.test(f)));
      setIndex(0);
    }).catch(() => setFiles([]));
  }, [path]);

  const advance = useCallback(() => {
    if (files.length === 0) return;
    setIndex(prev => shuffle ? Math.floor(Math.random() * files.length) : (prev + 1) % files.length);
  }, [files.length, shuffle]);

  useEffect(() => {
    if (files.length <= 1) return;
    const ms = Math.max(1, intervalSec) * 1000;
    timerRef.current = setInterval(advance, ms);
    return () => clearInterval(timerRef.current);
  }, [files.length, intervalSec, advance]);

  if (files.length === 0) return null;
  const file = files[index];
  if (!file) return null;
  try {
    return convertFileSrc(file);
  } catch {
    return `asset://localhost/${file.replace(/\\/g, "/")}`;
  }
}

export default function WallpaperEngine() {
  const wp = useSettingsStore((s) => s.wallpaper);
  const [singleSrc, setSingleSrc] = useState<string | null>(null);
  const folderSrc = useFolderImages(
    wp.mode === "folder" ? wp.path : "",
    wp.shuffle === "random",
    wp.interval,
  );

  useEffect(() => {
    if (wp.mode !== "single" || !wp.path) {
      setSingleSrc(null);
      return;
    }
    try {
      setSingleSrc(convertFileSrc(wp.path));
    } catch {
      setSingleSrc(`asset://localhost/${wp.path.replace(/\\/g, "/")}`);
    }
  }, [wp.mode, wp.path]);

  const src = wp.mode === "single" ? singleSrc : wp.mode === "folder" ? folderSrc : null;
  if (!src) return null;

  const isVideo = /\.(mp4|mkv|webm|avi|mov)$/i.test(wp.path || "");

  const baseStyle: React.CSSProperties = {
    transition: "opacity 0.6s ease",
  };

  const fitStyle: React.CSSProperties = (() => {
    if (wp.fit === "none") {
      return {
        width: "auto", height: "auto", maxWidth: "100vw", maxHeight: "100vh",
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
      } as React.CSSProperties;
    }
    return { width: "100%", height: "100%", objectFit: wp.fit === "contain" ? "contain" : wp.fit === "fill" ? "fill" : "cover" } as React.CSSProperties;
  })();

  const fullStyle = { ...baseStyle, ...fitStyle };

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {isVideo ? (
        <video key={src.slice(-20)} src={src} autoPlay loop muted playsInline style={fullStyle} />
      ) : (
        <img key={src.slice(-20)} src={src} alt="" style={fullStyle} />
      )}
    </div>
  );
}