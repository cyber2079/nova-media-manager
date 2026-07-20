import { useMemo } from "react";

/** Unified tag aggregation shared by all 4 media library pages. */
export function useAllTags(items: { tags?: string[] }[]): [MapEntries, string[]] {
  const allTags: MapEntries = useMemo(() => {
    const tc = new Map<string, number>();
    items.forEach((item) => item.tags?.forEach((t: string) => tc.set(t, (tc.get(t) || 0) + 1)));
    return Array.from(tc.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const tagNames = useMemo(() => allTags.map(([tag]) => tag), [allTags]);

  return [allTags, tagNames];
}

type MapEntries = [string, number][];
