import { keepPreviousData, useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { useMemo } from "react";

import { QueryKeyPart } from "@/lib/enums";

interface Page<T> {
  results: T[];
  meta?: { total?: number };
}

/**
 * A list loaded a page at a time: the first page at once, the next when the end of the list
 * comes into view (see LoadMore). The key starts with the one-page query's key, so whatever
 * invalidates that list invalidates this one too.
 */
export const usePaged = <T>({
  queryKey,
  fetchPage,
  pageSize,
  enabled = true,
  keepPrevious = false,
}: {
  queryKey: QueryKey;
  fetchPage: (offset: number, limit: number, signal: AbortSignal) => Promise<Page<T>>;
  pageSize: number;
  enabled?: boolean;
  /** Keep showing the last list while one with other filters loads */
  keepPrevious?: boolean;
}) => {
  const query = useInfiniteQuery({
    queryKey: [...queryKey, QueryKeyPart.Paged],
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, pageSize, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, page) => n + page.results.length, 0);
      const total = last.meta?.total;
      const more = total !== undefined ? loaded < total : last.results.length === pageSize;
      return more ? loaded : undefined;
    },
    enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.results) ?? [],
    [query.data],
  );
  return { ...query, items };
};
