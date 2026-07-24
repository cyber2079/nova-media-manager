// Blueprint Bento Grid — reusable bento layout components.
// Styled by theme.css under html[data-theme="cyber-grid"].
// Corner brackets + cyan glow + grid background = blueprint aesthetic.
import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ── BentoGrid ────────────────────────────────────────

export interface BentoGridProps {
  children?: ReactNode;
  className?: string;
}

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <div className={cn("bento-grid", className)}>
      {children}
    </div>
  );
}
BentoGrid.displayName = "BentoGrid";

// ── BentoItem ────────────────────────────────────────

export interface BentoItemProps {
  children?: ReactNode;
  className?: string;
}

export function BentoItem({ className, children }: BentoItemProps) {
  return (
    <div className={cn("bento-item", className)}>
      {/* Corner brackets for the holographic blueprint effect */}
      <div className="corner top-left" />
      <div className="corner top-right" />
      <div className="corner bottom-left" />
      <div className="corner bottom-right" />
      <div className="content-wrapper">
        {children}
      </div>
    </div>
  );
}
BentoItem.displayName = "BentoItem";
