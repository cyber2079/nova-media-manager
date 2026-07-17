import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { readFileSafe } from "@/lib/readFileSafe";

// ── 模块级 blob URL 缓存（跨组件生命周期，不随组件卸载失效）──
const blobCache = new Map<string, string>();
const pendingBlobs = new Map<string, Promise<string>>();

export async function toCachedBlob(filePath: string): Promise<string | null> {
  const cached = blobCache.get(filePath);
  if (cached) return cached;
  const pending = pendingBlobs.get(filePath);
  if (pending) return pending;
  const p = (async () => {
    const ext = (filePath.split(".").pop() || "png").toLowerCase();
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
      svg: "image/svg+xml", ico: "image/x-icon",
    };
    const mime = mimeMap[ext] || "image/png";
    const data = await readFileSafe(filePath);
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    blobCache.set(filePath, url);
    return url;
  })();
  pendingBlobs.set(filePath, p);
  try { return await p; } finally { pendingBlobs.delete(filePath); }
}

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
  const [inView, setInView] = useState(false);
  const mountedRef = useRef(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── IntersectionObserver: lazy-load only when near viewport ──
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  // ── Load image (only when in view) ──
  useEffect(() => {
    if (!inView) return;
    setUrl("");
    setOk(false);
    setFailed(false);
    setLoading(true);

    if (!src) { setFailed(true); setLoading(false); return; }

    // Web URL / data URL / blob / theme — use directly
    if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("/themes/")) {
      setUrl(src);
      setOk(true);
      setLoading(false);
      return;
    }

    const filePath = src.replace(/^file:\/\/\//, "").replace(/^file:\/\//, "");

    let cancelled = false;
    (async () => {
      try {
        const cached = await toCachedBlob(filePath);
        if (cancelled || !mountedRef.current) return;
        if (cached) {
          setUrl(cached);
          setOk(true);
          setLoading(false);
        } else {
          setFailed(true);
          setLoading(false);
        }
      } catch {
        if (cancelled || !mountedRef.current) return;
        setFailed(true);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [src, inView]);

  if (failed && fallback) return <>{fallback}</>;
  if (failed) return <div ref={containerRef} className={cn("flex items-center justify-center bg-surface-lighter", className)}>🖼</div>;

  if (loading || !ok) return <div ref={containerRef} className={cn("animate-pulse bg-surface-lighter", className)} />;

  if (ok && url) {
    return (
      <img
        ref={containerRef as any}
        src={url} alt={alt} className={className} style={style}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        onLoad={(e) => { if (onImageLoad) onImageLoad(e.currentTarget); }}
      />
    );
  }

  if (fallback) return <>{fallback}</>;
  return <div ref={containerRef} className={cn("flex items-center justify-center bg-surface-lighter", className)}>🖼</div>;
}
