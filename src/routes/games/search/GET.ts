import { Elysia, t } from "elysia";

import {
  MAX_QUERY_LENGTH,
  MAX_SEARCH_LIMIT,
  searchGamesWithCache,
} from "@/utils/searchGames";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";

// Searches can enqueue IGDB work, so keep a per-client budget
const searchLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
const freshSearchLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

export const getGamesSearch = new Elysia().get(
  "/games/search",
  async ({ query, request, server }) => {
    const key = clientKey({ request, server });
    const forceFresh = query.fresh === "true" || query.fresh === "1";

    searchLimiter.check(key);
    if (forceFresh) freshSearchLimiter.check(key);

    const limit = query.limit ?? MAX_SEARCH_LIMIT;
    const offset = query.offset ?? 0;

    const searchResults = await searchGamesWithCache(query.q, limit, offset, forceFresh);

    return {
      results: searchResults.results,
      meta: {
        total: searchResults.meta.total,
        limit,
        offset,
      },
    };
  },
  {
    query: t.Object({
      q: t.String({ maxLength: MAX_QUERY_LENGTH }),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_SEARCH_LIMIT })),
      offset: t.Optional(t.Numeric({ minimum: 0 })),
      fresh: t.Optional(t.String()),
    }),
  }
);
