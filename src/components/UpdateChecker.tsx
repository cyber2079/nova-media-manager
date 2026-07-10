import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, Loader2, X } from "lucide-react";

export default function UpdateChecker() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const [update, setUpdate] = useState<{
    version: string;
    notes: string;
    date: string;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Check for updates on mount (only in Pro/Ultra)
  useEffect(() => {
    // Community edition (free) doesn't get updates via the updater plugin
    // Check license first — but for now, always check
    let cancelled = false;

    const checkUpdate = async () => {
      try {
        const result = await check();
        if (!result || cancelled) return;

        setUpdate({
          version: result.version,
          notes: result.body || "",
          date: result.date || "",
        });
      } catch {
        // No update available or network error — silent
      }
    };

    // Delay check to not block startup
    const timer = setTimeout(checkUpdate, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const handleDownload = async () => {
    if (!update) return;
    setDownloading(true);

    try {
      const result = await check();
      if (!result) return;

      let downloaded = 0;
      let total = 0;

      await result.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength || 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (total > 0) setProgress(Math.round((downloaded / total) * 100));
            break;
          case "Finished":
            break;
        }
      });

      // Relaunch after install
      await relaunch();
    } catch (err) {
      console.error("[updater] download failed:", err);
      setDownloading(false);
      setProgress(0);
    }
  };

  const handleDismiss = () => setDismissed(true);

  if (!update || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[250] max-w-sm bg-surface-light/98 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl p-5 space-y-3 animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">
            {isZh ? "发现新版本" : "Update Available"}
          </h3>
          <p className="text-xs text-gray-400">
            v{update.version} &middot; {update.date}
          </p>
        </div>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-white p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Notes */}
      {update.notes && (
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line max-h-20 overflow-y-auto">
          {update.notes}
        </p>
      )}

      {/* Progress bar */}
      {downloading && (
        <div className="space-y-1.5">
          <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 text-center">{progress}%</p>
        </div>
      )}

      {/* Download button */}
      {!downloading && (
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Download className="h-4 w-4" />
          {isZh ? "立即更新" : "Update Now"}
        </button>
      )}

      {downloading && (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/50 text-white/50 text-sm font-medium"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {isZh ? "正在下载..." : "Downloading..."}
        </button>
      )}
    </div>
  );
}
