import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { readFileSafe } from "@/lib/readFileSafe";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
  onImageLoad?: (img: HTMLImageElement) => void;
}

export default function SafeImage({ src, alt, className, fallback, style, onImageLoad }: SafeImageProps) {
  const [url, setUrl] = useState<string>("");
  const [ok, setOk] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const blobRef = useRef<string | null>(null);

  // Cleanup old blob
  function release() {
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; }
  }

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => () => release(), []);

  // Load image
  useEffect(() => {
    release();
    setUrl("");
    setOk(false);
    setFailed(false);
    setLoading(true);

    if (!src) { setFailed(true); setLoading(false); return; }

    // Already a web URL / data URL / blob — use directly
    if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("/themes/")) {
      setUrl(src);
      setOk(true);
      setLoading(false);
      return;
    }

    // Local path — strip file:// prefix
    const filePath = src.replace(/^file:\/\/\//, "").replace(/^file:\/\//, "");

    let cancelled = false;
    (async () => {
      try {
        const ext = (filePath.split(".").pop() || "png").toLowerCase();
        const mimeMap: Record<string, string> = {
          png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
          gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
          svg: "image/svg+xml", ico: "image/x-icon",
        };
        const mime = mimeMap[ext] || "image/png";
        const data = await readFileSafe(filePath);
        if (cancelled || !mountedRef.current) return;
        const blob = new Blob([data], { type: mime });
        const objUrl = URL.createObjectURL(blob);
        if (cancelled || !mountedRef.current) { URL.revokeObjectURL(objUrl); return; }
        release();
        blobRef.current = objUrl;
        setUrl(objUrl);
        setOk(true);
        setLoading(false);
      } catch {
        if (cancelled || !mountedRef.current) return;
        setFailed(true);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [src]);

  // Show fallback on failure
  if (failed && fallback) return <>{fallback}</>;
  if (failed) return <div className={cn("flex items-center justify-center bg-surface-lighter", className)}>🖼</div>;

  // Show skeleton while loading
  if (loading) return <div className={cn("animate-pulse bg-surface-lighter", className)} />;

  // Show the image
  if (ok && url) {
    return <img src={url} alt={alt} className={className} style={style} onError={() => setFailed(true)}
      onLoad={(e) => { if (onImageLoad) onImageLoad(e.currentTarget); }} />;
  }

  // Fallthrough
  if (fallback) return <>{fallback}</>;
  return <div className={cn("flex items-center justify-center bg-surface-lighter", className)}>🖼</div>;
}
