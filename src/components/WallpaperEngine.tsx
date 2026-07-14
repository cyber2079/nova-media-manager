import { useEffect, useRef, useState, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";

async function listImages(dir: string): Promise<string[]> {
  try { return await invoke<string[]>("wallpaper_list_images", { path: dir }); }
  catch { return []; }
}

function useFolderImages(path: string, shuffle: boolean, intervalSec: number): string | null {
  const [files, setFiles] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!path) { setFiles([]); return; }
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
  try { return convertFileSrc(file); } catch { return `asset://localhost/${file.replace(/\\/g, "/")}`; }
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
    if (wp.mode !== "single" || !wp.path) { setSingleSrc(null); return; }
    try { setSingleSrc(convertFileSrc(wp.path)); }
    catch { setSingleSrc(`asset://localhost/${wp.path.replace(/\\/g, "/")}`); }
  }, [wp.mode, wp.path]);

  const src = wp.mode === "single" ? singleSrc : wp.mode === "folder" ? folderSrc : null;
  if (!src) return null;

  /* fit=none → 原始尺寸居中，大图自动限幅；fill → 拉伸；其余(=cover) → 等比填满 */
  const imgStyle: React.CSSProperties = (() => {
    if (wp.fit === "none") {
      return {
        width: "auto", height: "auto",
        opacity: `var(--bg-opacity, 0.7)`,
      };
    }
    if (wp.fit === "fill") {
      return {
        width: "100%", height: "100%",
        objectFit: "fill",
        opacity: `var(--bg-opacity, 0.7)`,
      };
    }
    return {
      width: "100%", height: "100%",
      objectFit: "cover",
      opacity: `var(--bg-opacity, 0.7)`,
    };
  })();

  const isNone = wp.fit === "none";
  return (
    <>
      <div className={`fixed z-0 pointer-events-none ${isNone ? "" : "inset-0 flex items-center justify-center"}`}>
          <img src={src} alt="" style={imgStyle} className={isNone ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : ""} />
      </div>
      <div className="fixed inset-0 z-[1] pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(8,12,20,0.55) 0%, rgba(8,12,20,0.3) 50%, rgba(8,12,20,0.55) 100%)" }}
      />
    </>
  );
}
