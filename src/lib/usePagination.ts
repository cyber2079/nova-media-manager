import { useState, useMemo, useEffect } from "react";

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // clamp page when list shrinks (e.g. search/filter), but don't reset
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [items.length]);

  const paginated = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return { page, setPage, totalPages, paginated, pageSize };
}
