import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useLicenseStore } from "@/stores/licenseStore";
import { useThemePackStore } from "@/stores/themePackStore";
import { Sparkles, Loader2, CheckCircle, XCircle, Download } from "lucide-react";

const STORAGE_KEY = "nova-onboarding-complete";

export function isOnboardingDone(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

type Phase = "welcome" | "activating" | "downloading" | "done";

export default function OnboardingDialog() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const { activate } = useLicenseStore();
  const { fetchAvailable, installFromServer } = useThemePackStore();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Download progress
  const [dlTotal, setDlTotal] = useState(0);
  const [dlDone, setDlDone] = useState(0);
  const [dlCurrent, setDlCurrent] = useState("");

  useEffect(() => {
    // Show on first launch only.
    // Guard: if license already active (e.g. activated but download was interrupted),
    // skip the dialog — Layout's resume effect will pick up the missing themes.
    if (!isOnboardingDone() && useLicenseStore.getState().license.tier === "free") {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
    // If already Pro+ but flag not set (interrupted download), mark done and skip
    if (!isOnboardingDone() && useLicenseStore.getState().license.tier !== "free") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }, []);

  const handleFree = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const handleStartActivation = () => {
    setPhase("activating");
    setError(null);
  };

  const handleActivate = async () => {
    const clean = code.replace(/\s/g, "").toUpperCase();
    if (clean.length < 16) {
      setError(isZh ? "激活码格式不正确" : "Invalid code format");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await activate(clean);
      startDownload();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async () => {
    setPhase("downloading");
    setDlDone(0);
    try {
      await fetchAvailable();
      // Read fresh state after fetch
      const themes = useThemePackStore.getState().availableThemes;
      // Only download premium themes
      const premium = themes.filter(t => t.requires_license !== "free");
      setDlTotal(premium.length);

      if (premium.length === 0) {
        // No themes to download — smooth finish
        setPhase("done");
        setTimeout(() => setOpen(false), 1200);
        return;
      }

      for (const theme of premium) {
        setDlCurrent(theme.name || theme.id);
        try {
          await installFromServer(theme.id);
        } catch {
          // Continue past individual failures
        }
        setDlDone((n) => n + 1);
      }

      // Only mark onboarding complete AFTER all downloads finish successfully
      localStorage.setItem(STORAGE_KEY, "1");
      setPhase("done");
      setTimeout(() => setOpen(false), 1500);
    } catch {
      // Server unreachable — user is activated but themes not downloaded.
      // Mark onboarding complete anyway so the dialog doesn't block forever.
      // The next startup will detect missing themes and resume download.
      localStorage.setItem(STORAGE_KEY, "1");
      setPhase("done");
      setTimeout(() => setOpen(false), 1200);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleActivate();
  };

  const pct = dlTotal > 0 ? Math.round((dlDone / dlTotal) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent
        className="max-w-md p-0 rounded-2xl border-primary/30 overflow-hidden"
        style={{ background: "color-mix(in srgb, var(--color-primary) 6%, #080c14)" }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Decorative top bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary-light to-primary" />

        {phase === "welcome" && (
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--color-primary) 15%, transparent)" }}>
              <Sparkles className="h-8 w-8 text-primary-light" />
            </div>

            <DialogTitle className="text-2xl font-bold">
              {isZh ? "欢迎使用 Nova" : "Welcome to Nova"}
            </DialogTitle>

            <p className="text-sm text-gray-400 leading-relaxed">
              {isZh
                ? "一站式管理你的电影、音乐、图片和游戏。精美主题，沉浸体验。全功能免费，没有任何限制。"
                : "Movies, music, images, games — all in one place. Premium themes, immersive experience. Free with all features included."}
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleFree}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:brightness-110 transition-all active:scale-[0.98]"
              >
                {isZh ? "免费使用" : "Start Free"}
              </button>
              <button
                onClick={handleStartActivation}
                className="w-full py-3 rounded-xl border border-white/10 text-gray-300 font-medium text-sm hover:bg-white/5 transition-all active:scale-[0.98]"
              >
                {isZh ? "我有激活码" : "I Have a Code"}
              </button>
            </div>
          </div>
        )}

        {phase === "activating" && (
          <div className="p-8 space-y-5">
            <DialogTitle className="text-lg font-semibold">
              {isZh ? "输入激活码" : "Enter Activation Code"}
            </DialogTitle>

            <p className="text-sm text-gray-400">
              {isZh
                ? "请输入爱发电订单页中的激活码"
                : "Enter the code from your Afdian order page"}
            </p>

            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white text-center text-lg tracking-widest font-mono placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
              autoFocus
            />

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setPhase("welcome"); setError(null); setCode(""); }}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors"
              >
                {isZh ? "返回" : "Back"}
              </button>
              <button
                onClick={handleActivate}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? (isZh ? "验证中..." : "Verifying...") : (isZh ? "确认激活" : "Activate")}
              </button>
            </div>
          </div>
        )}

        {phase === "downloading" && (
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--color-primary) 15%, transparent)" }}>
              <Download className="h-8 w-8 text-primary-light animate-pulse" />
            </div>

            <DialogTitle className="text-xl font-bold">
              {isZh ? "正在解锁 Premium 主题..." : "Unlocking Premium Themes..."}
            </DialogTitle>

            {/* Progress bar */}
            <div className="space-y-3">
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {dlCurrent ? `${dlCurrent} · ` : ""}
                {pct}%
                {dlTotal > 0 && ` · ${dlDone}/${dlTotal}`}
              </p>
            </div>

            <p className="text-xs text-gray-500">
              {isZh
                ? "全部就绪后将自动进入主界面"
                : "The app will open automatically when ready"}
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="p-8 flex flex-col items-center gap-4 py-12">
            <CheckCircle className="h-14 w-14 text-green-400" />
            <p className="text-green-400 font-bold text-lg">
              {isZh ? "激活成功！" : "Activated!"}
            </p>
            <p className="text-sm text-gray-400">
              {isZh ? "Premium 主题已就绪" : "Premium themes ready"}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
