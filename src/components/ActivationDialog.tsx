import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useLicenseStore } from "@/stores/licenseStore";
import { Key, Loader2, CheckCircle, XCircle } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";

export default function ActivationDialog() {
  const { t } = useTranslation();
  const { activationOpen, closeActivation, activate } = useLicenseStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    const clean = code.replace(/\s/g, "").toUpperCase();
    if (clean.length < 16) {
      setError(t("activation.invalid_format"));
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
          <NeonIcon name="Key" size={16}><Key className="h-5 w-5 text-primary-light" /></NeonIcon>
          {t("activation.title")}
        </DialogTitle>

        <div className="space-y-4 mt-4">
          {!success ? (
            <>
              <p className="text-sm text-gray-400">
                {t("activation.placeholder_hint")}
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
                  <NeonIcon name="XCircle" size={16}><XCircle className="h-4 w-4" /></NeonIcon>
                  {error}
                </div>
              )}
              <button
                onClick={handleActivate}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {loading && <NeonIcon name="Loader2" size={16}><Loader2 className="h-4 w-4 animate-spin" /></NeonIcon>}
                {loading ? t("activation.verifying") : t("activation.activate")}
              </button>
              <p className="text-xs text-gray-500 text-center">
                {t("activation.buy_hint")}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <NeonIcon name="CheckCircle" size={16}><CheckCircle className="h-12 w-12 text-green-400" /></NeonIcon>
              <p className="text-green-400 font-semibold">
                {t("activation.success")}
              </p>
              <p className="text-sm text-gray-400">
                {t("activation.success_detail")}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
