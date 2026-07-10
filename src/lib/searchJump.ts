/**
 * Shared jump-target channel between GlobalSearch and library pages.
 *
 * - GlobalSearch sets the target before navigating.
 * - Each library reads & clears it on mount to jump to the correct page.
 */

import { useEffect } from "react";

let _target: { id: string } | null = null;

export function setSearchJumpTarget(id: string) {
  _target = { id };
}

export function consumeSearchJumpTarget(): string | null {
  const id = _target?.id ?? null;
  _target = null;
  return id;
}

/** Hook: on mount, jump pagination to the page containing targetId (if set by search). */
export function useSearchJump<T extends { id: string }>(
  items: T[],
  pageSize: number,
  setPage: (p: number) => void
) {
  useEffect(() => {
    const targetId = consumeSearchJumpTarget();
    if (!targetId) return;
    const idx = items.findIndex((it) => it.id === targetId);
    if (idx >= 0) {
      setPage(Math.floor(idx / pageSize) + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
