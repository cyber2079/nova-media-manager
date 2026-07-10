import { memo, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  hint: string;
  className?: string;
}

export default memo(function EmptyState({ icon, title, hint, className }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 text-gray-500", className)}>
      <div className="mb-4 animate-bounce">{icon}</div>
      <p className="text-lg">{title}</p>
      <p className="mt-1 text-sm">{hint}</p>
      <div className="mt-8 flex flex-col items-center gap-1 opacity-40">
        <div className="h-14 w-24 rounded-xl border-2 border-dashed border-primary flex items-center justify-center">
          <svg className="h-6 w-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14m-7-7h14" />
          </svg>
        </div>
        <span className="text-[10px] mt-1">{t("music.drag_to_import")}</span>
      </div>
    </div>
  );
}
)