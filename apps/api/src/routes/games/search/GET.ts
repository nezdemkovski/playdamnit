import { Elysia, t } from "elysia";

import { MAX_QUERY_LENGTH, MAX_SEARCH_LIMIT, searchGames } from "@/utils/searchGames";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";
import { isFlagSet } from "@/utils/enums";

const searchLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const getGamesSearch = new Elysia().get(
  "/games/search",
  {
    query: t.Object({
      q: t.String({ maxLength: MAX_QUERY_LENGTH }),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_SEARCH_LIMIT })),
      offset: t.Optional(t.Numeric({ minimum: 0 })),
      // "1"/"true" also returns editions (Deluxe, GOTY, ...), hidden by default
      editions: t.Optional(t.String()),
      // Comma-separated IGDB game_type ids (0 = Main Game, 1 = DLC, 8 = Remake, ...)
      types: t.Optional(t.String()),
    }),
  },
  async ({ query, request, server }) => {
    searchLimiter.check(clientKey({ request, server }));

    const limit = query.limit ?? MAX_SEARCH_LIMIT;
    const offset = query.offset ?? 0;
    const gameTypes = (query.types ?? "")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v >= 0);

    const searchResults = await searchGames(query.q, {
      limit,
      offset,
      includeEditions: isFlagSet(query.editions),
      gameTypes,
    });

    return {
      results: searchResults.results,
      meta: {
        total: searchResults.meta.total,
        limit,
        offset,
      },
    };
  },
);
