import { useState, useCallback } from "react";
import ContextMenu from "@/components/ContextMenu";

export function useContextMenu() {
  const [ctx, setCtx] = useState<{ x: number; y: number; path: string } | null>(null);

  const onContext = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, path });
  }, []);

  const menu = ctx ? (
    <ContextMenu show={!!ctx} x={ctx.x} y={ctx.y} filePath={ctx.path} onClose={() => setCtx(null)} />
  ) : null;

  return { onContext, menu };
}
