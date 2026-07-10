import { useState, useCallback } from "react";

export function useBatchSelect(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(false);

  const isBatchMode = active && selected.size > 0;

  const toggle = useCallback((id: string) => {
    if (!active) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [active]);

  /** Enter batch-select mode — show checkboxes, user can pick items */
  const enterBatchMode = useCallback(() => {
    setActive(true);
    setSelected(new Set());
  }, []);

  const leaveBatchMode = useCallback(() => {
    setActive(false);
    setSelected(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(allIds));
  }, [allIds]);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const invert = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of allIds) {
        if (!prev.has(id)) next.add(id);
      }
      return next;
    });
  }, [allIds]);

  return {
    selected,
    isBatchMode,
    /** True when checkboxes should be visible (guard before first toggle) */
    showCheckboxes: active,
    toggle,
    enterBatchMode,
    leaveBatchMode,
    selectAll,
    clear,
    invert,
    count: selected.size,
  };
}
