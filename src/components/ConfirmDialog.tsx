import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, message, confirmLabel, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="rounded-xl border border-primary/30 p-6 shadow-2xl max-w-sm w-full mx-4"
        style={{ background: "color-mix(in srgb, var(--color-primary) 6%, rgba(8,12,20,0.94))" }}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}>
        <p className="text-sm text-gray-300">{message}</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>{t("settings.cancel")}</Button>
          <Button variant="ghost" size="sm" onClick={onConfirm} className="text-red-400 hover:text-red-300">
            {confirmLabel || t("settings.confirm_delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
