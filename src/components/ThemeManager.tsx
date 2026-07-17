/**
 * Theme Manager — install, browse, and manage .nvtp theme packs.
 *
 * Ultra/Premium feature: free tier users see a limited view.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemePackStore, type InstalledTheme, type ThemePackInfo } from "@/stores/themePackStore";
import { useLicenseStore, isPro, isUltra } from "@/stores/licenseStore";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Package, Download, Trash2, Loader2, FolderOpen } from "lucide-react";

export default function ThemeManager() {
  const { t } = useTranslation();
  const { installedThemes, availableThemes, loading, refresh, installFromFile, installFromServer, remove, fetchAvailable } = useThemePackStore();
  const { license } = useLicenseStore();
  const [open, setOpen] = useState(false);
  const [filePath, setFilePath] = useState("");
  const [status, setStatus] = useState<"" | "loading" | "ok" | "error">("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (open) {
      refresh();
      if (isPro(license.tier)) fetchAvailable();
    }
  }, [open]);

  const handleInstallFromServer = async (info: ThemePackInfo) => {
    const ok = isPro(license.tier) && info.requires_license !== "ultra"
      || isUltra(license.tier);
    if (!ok) {
      setStatus("error");
      setStatusMsg(t("themeManager.license_denied"));
      return;
    }
    setStatus("loading");
    setStatusMsg(t("themeManager.downloading_installing"));
    try {
      await installFromServer(info.id);
      setStatus("ok");
      setStatusMsg(t("themeManager.install_success"));
    } catch (e) {
      setStatus("error");
      setStatusMsg(String(e));
    }
  };

  const handleRemove = async (id: string) => {
    try { await remove(id); } catch { /* ignore */ }
  };

  return (<>
    <button onClick={() => setOpen(true)}
      className="text-gray-400 hover:text-white flex items-center gap-1.5 text-xs font-medium transition-colors">
      <Package className="h-3.5 w-3.5" />
      {t("themeManager.trigger_button")}
    </button>

    <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-6 rounded-2xl bg-surface-light/98 backdrop-blur-xl border border-primary/30">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold mb-6">
          <Package className="h-5 w-5 text-primary-light" />
          {t("themeManager.dialog_title")}
        </DialogTitle>

        {/* ── Status ── */}
        {status && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${status === "error" ? "bg-red-500/10 text-red-400" : status === "ok" ? "bg-green-500/10 text-green-400" : "bg-primary/10 text-primary-light"}`}>
            {status === "loading" && <Loader2 className="h-4 w-4 inline animate-spin mr-2" />}
            {statusMsg}
          </div>
        )}

        {/* ── Install from file ── */}
        <div className="mb-6 p-4 rounded-xl bg-surface-lighter/50 border border-white/5">
          <h4 className="text-sm font-semibold text-white mb-3">
            {t("themeManager.install_local")}
          </h4>
          <div className="flex gap-2">
            <input type="text" value={filePath} onChange={(e) => setFilePath(e.target.value)}
              placeholder="D:\\themes\\my-theme.nvtp"
              className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-primary/50" />
            <button onClick={async () => {
              if (!filePath) return;
              setStatus("loading");
              setStatusMsg(t("themeManager.installing"));
              try { await installFromFile(filePath); setStatus("ok"); setStatusMsg(t("themeManager.install_success")); setFilePath(""); }
              catch (e) { setStatus("error"); setStatusMsg(String(e)); }
            }} disabled={loading} className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap">
              <FolderOpen className="h-3.5 w-3.5 inline mr-1" />
              {t("themeManager.install")}
            </button>
          </div>
        </div>

        {/* ── Installed themes ── */}
        <h4 className="text-sm font-semibold text-white mb-3">
          {t("themeManager.installed_themes")} ({installedThemes.length})
        </h4>
        {installedThemes.length === 0 && (
          <p className="text-xs text-gray-500 mb-4">{t("themeManager.no_installed")}</p>
        )}
        <div className="space-y-2 mb-6">
          {installedThemes.map((theme) => (
            <div key={theme.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-lighter/30 border border-white/5">
              <div>
                <p className="text-sm font-medium text-white">{theme.name}</p>
                <p className="text-[11px] text-gray-500">{theme.id} · v{theme.version} · {theme.author}</p>
              </div>
              <button onClick={() => handleRemove(theme.id)} className="text-gray-400 hover:text-red-400 p-1.5 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* ── Available themes (server) ── */}
        {isPro(license.tier) && (
          <>
            <h4 className="text-sm font-semibold text-white mb-3">
              {t("themeManager.available_themes")} ({availableThemes.length})
            </h4>
            <div className="space-y-2">
              {availableThemes.map((info) => (
                <div key={info.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-lighter/30 border border-white/5">
                  <div>
                    <p className="text-sm font-medium text-white">{info.name}</p>
                    <p className="text-[11px] text-gray-500">{info.id} · {(info.file_size / 1024 / 1024).toFixed(1)} MB · {info.requires_license}</p>
                  </div>
                  <button onClick={() => handleInstallFromServer(info)} disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary-light hover:bg-primary/25 text-xs font-medium transition-colors disabled:opacity-50">
                    <Download className="h-3.5 w-3.5 inline mr-1" />
                    {t("themeManager.download")}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  </>);
}
