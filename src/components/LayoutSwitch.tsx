import { memo } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, LayoutList, LayoutPanelTop, LayoutTemplate } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";

export type LayoutMode = "card" | "small" | "list" | "banner";

interface LayoutSwitchProps {
  mode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

export default memo(function LayoutSwitch({ mode, onChange, hideBanner }: LayoutSwitchProps & { hideBanner?: boolean }) {
  const { t } = useTranslation();

  const allModes: { key: LayoutMode; icon: typeof LayoutGrid; label: string }[] = [
    { key: "card", icon: LayoutGrid, label: t("music.layout_large") },
    { key: "small", icon: LayoutPanelTop, label: t("music.layout_small") },
    { key: "banner", icon: LayoutTemplate, label: t("game.layout_banner") },
    { key: "list", icon: LayoutList, label: t("music.layout_list") },
  ];
  const modes = hideBanner ? allModes.filter(m => m.key !== "banner") : allModes;

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