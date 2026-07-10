import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const POS_MAP = {
  "top-left":      "top-20 left-5",
  "top-right":     "top-20 right-5",
  "center-left":   "top-1/2 -translate-y-1/2 left-5",
  "center-right":  "top-1/2 -translate-y-1/2 right-5",
  "bottom-left":   "bottom-20 left-5",
  "bottom-right":  "bottom-20 right-5",
};

export default function DesktopWidget({ position, children, className }: {
  position: string;
  children: ReactNode;
  className?: string;
}) {
  const pos = POS_MAP[position as keyof typeof POS_MAP] || "bottom-20 right-5";

  return (
    <div className={cn("fixed z-[2] select-none", pos, className)}>
      {children}
    </div>
  );
}
