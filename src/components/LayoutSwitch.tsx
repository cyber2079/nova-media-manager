import { memo } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, LayoutList, LayoutPanelTop } from "lucide-react";

export type LayoutMode = "card" | "small" | "list";

interface LayoutSwitchProps {
  mode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

export default memo(function LayoutSwitch({ mode, onChange }: LayoutSwitchProps) {
  const { t } = useTranslation();

  const modes: { key: LayoutMode; icon: typeof LayoutGrid; label: string }[] = [
    { key: "card", icon: LayoutGrid, label: t("music.layout_large") },
    { key: "small", icon: LayoutPanelTop, label: t("music.layout_small") },
    { key: "list", icon: LayoutList, label: t("music.layout_list") },
  ];

  return (
    <div className="flex gap-1">
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          title={m.label}
          className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
            mode === m.key
              ? "bg-primary/15 text-primary-light"
              : "text-gray-500 hover:text-white hover:bg-surface-lighter"
          }`}
        >
          <m.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
)