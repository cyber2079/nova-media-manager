import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useLicenseStore } from "@/stores/licenseStore";
import { Key, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function ActivationDialog() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const { activationOpen, closeActivation, activate } = useLicenseStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    const clean = code.replace(/\s/g, "").toUpperCase();
    if (clean.length < 16) {
      setError(isZh ? "激活码格式不正确" : "Invalid activation code format");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await activate(clean);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCode("");
        closeActivation();
      }, 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleActivate();
  };

  return (
    <Dialog open={activationOpen} onOpenChange={(o) => { if (!o) closeActivation(); }}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-surface-light/98 backdrop-blur-xl border border-primary/30">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <Key className="h-5 w-5 text-primary-light" />
          {isZh ? "激活许可证" : "Activate License"}
        </DialogTitle>

        <div className="space-y-4 mt-4">
          {!success ? (
            <>
              <p className="text-sm text-gray-400">
                {isZh
                  ? "请输入您的激活码（格式：XXXX-XXXX-XXXX-XXXX）"
                  : "Enter your activation code (format: XXXX-XXXX-XXXX-XXXX)"}
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
                  <XCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              <button
                onClick={handleActivate}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? (isZh ? "验证中..." : "Verifying...") : (isZh ? "激活" : "Activate")}
              </button>
              <p className="text-xs text-gray-500 text-center">
                {isZh
                  ? "激活码购买地址：请联系开发者或在爱发电获取"
                  : "Purchase activation codes on Afdian or contact developer"}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="h-12 w-12 text-green-400" />
              <p className="text-green-400 font-semibold">
                {isZh ? "激活成功！" : "Activated!"}
              </p>
              <p className="text-sm text-gray-400">
                {isZh ? "专业版功能已解锁" : "Pro features unlocked"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
