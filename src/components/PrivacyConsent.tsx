import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { analytics } from "@/lib/analytics";
import { Shield } from "lucide-react";

export default function PrivacyConsent() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if consent has been given
    const consent = analytics.hasConsent();
    if (consent === null) {
      // Not asked yet — show dialog after a short delay
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    analytics.setConsent(true);
    setVisible(false);
  };

  const handleDecline = () => {
    analytics.setConsent(false);
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light/98 border border-white/10 rounded-2xl max-w-lg w-full mx-4 p-8 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Shield className="h-5 w-5 text-primary-light" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            {isZh ? "帮助我们改进产品" : "Help Us Improve"}
          </h2>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed">
          {isZh
            ? "我们想收集匿名的使用数据来改进应用体验。这些数据仅包括："
            : "We'd like to collect anonymous usage data to improve the app. This only includes:"}
        </p>

        <ul className="text-xs text-gray-400 space-y-1.5 list-disc pl-5">
          {isZh ? (
            <>
              <li>您使用的主题和切换频率</li>
              <li>各个功能的使用情况</li>
              <li>应用崩溃和错误报告</li>
            </>
          ) : (
            <>
              <li>Which themes you use and how often</li>
              <li>Feature usage patterns</li>
              <li>App crash and error reports</li>
            </>
          )}
        </ul>

        <p className="text-xs text-gray-500 leading-relaxed">
          {isZh ? (
            <>我们<strong>绝不</strong>收集：文件名、文件路径、媒体内容、个人身份信息。您可以随时在设置中更改此选项。</>
          ) : (
            <>We <strong>never</strong> collect: file names, file paths, media content, or personal identifiers. You can change this anytime in settings.</>
          )}
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleAccept}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            {isZh ? "同意" : "Accept"}
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors text-sm font-medium"
          >
            {isZh ? "拒绝" : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}
