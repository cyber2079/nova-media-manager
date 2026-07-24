/**
 * Privacy + EULA consent dialog — shown on first launch.
 *
 * Must be accepted to use the app. Consent is stored in localStorage.
 * Analytics consent is separate and handled in Settings.
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Shield, FileText, ExternalLink } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";

const CONSENT_KEY = "legal_consent_v1";
const PRIVACY_URL = "https://scm-think.cn/privacy.html";
const TERMS_URL = "https://scm-think.cn/terms.html";

function openUrl(url: string) {
  try {
    import("@tauri-apps/plugin-shell").then((m) => m.open(url)).catch(() => window.open(url, "_blank"));
  } catch {
    window.open(url, "_blank");
  }
}

export default function PrivacyConsent() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(CONSENT_KEY);
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "true");
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-light/98 border border-white/10 rounded-2xl max-w-lg w-full mx-4 p-8 shadow-2xl space-y-5 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <NeonIcon name="Shield" size={16}><Shield className="h-5 w-5 text-primary-light" /></NeonIcon>
          </div>
          <h2 className="text-lg font-semibold text-white">
            {t("privacy.title")}
          </h2>
        </div>

        {/* Summary */}
        <p className="text-sm text-gray-300 leading-relaxed">
          {t("privacy.legal_summary")}
        </p>

        {/* Link buttons to full docs */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => openUrl(PRIVACY_URL)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-primary-light text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <NeonIcon name="Shield" size={16}><Shield className="h-4 w-4" /></NeonIcon>
            <span>{t("privacy.view_policy")}</span>
            <NeonIcon name="ExternalLink" size={16}><ExternalLink className="h-3 w-3 opacity-50" /></NeonIcon>
          </button>
          <button
            type="button"
            onClick={() => openUrl(TERMS_URL)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-primary-light text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <NeonIcon name="FileText" size={16}><FileText className="h-4 w-4" /></NeonIcon>
            <span>{t("privacy.view_terms")}</span>
            <NeonIcon name="ExternalLink" size={16}><ExternalLink className="h-3 w-3 opacity-50" /></NeonIcon>
          </button>
        </div>

        {/* Key points from legal docs */}
        <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="text-primary-light mt-0.5">•</span>
            <span>{t("privacy.point_data")}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-light mt-0.5">•</span>
            <span>{t("privacy.point_device")}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-light mt-0.5">•</span>
            <span>{t("privacy.point_refund")}</span>
          </div>
        </div>

        {/* Accept button */}
        <button
          onClick={handleAccept}
          className="w-full py-3 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-semibold tracking-wide"
        >
          {t("privacy.agree")}
        </button>

        <p className="text-[10px] text-gray-500 text-center leading-relaxed">
          {t("privacy.agree_hint")}
        </p>
      </div>
    </div>
  );
}
