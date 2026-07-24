import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Shuffle, Repeat, Repeat1, ListMusic } from "lucide-react";
import NeonIcon from "@/components/NeonIcon";
import { usePlaylistStore } from "@/stores/playlistStore";
import { cn } from "@/lib/utils";

export default function PlayModeControls() {
  const { t } = useTranslation();
  const { playMode, setPlayMode } = usePlaylistStore();

  const modes = [
    { key: "sequential" as const, icon: ListMusic, label: t("music.play_mode_sequential") },
    { key: "repeat-one" as const, icon: Repeat1, label: t("music.play_mode_repeat_one") },
    { key: "repeat-all" as const, icon: Repeat, label: t("music.play_mode_repeat_list") },
    { key: "shuffle" as const, icon: Shuffle, label: t("music.play_mode_shuffle") },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {modes.map((m) => (
        <Button
          key={m.key}
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 text-gray-500 hover:text-white transition-colors", playMode === m.key && "text-primary-light bg-primary/10")}
          title={m.label}
          onClick={() => setPlayMode(m.key)}
        >
          <m.icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  );
}
