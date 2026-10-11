import { count, desc, ilike, or, sql, type Column, type SQL } from "drizzle-orm";

import { db } from "@/db/postgres";
import { game, igdbSearchLog } from "@playdamnit/db/schema";
import { GAME_CARD_COLUMNS, GAME_CARD_WITH, transformGameResponse } from "@/utils/gameTransformers";
import { requestIgdbSearch } from "@/utils/catalogRequests";
import { createLogger } from "@/utils/enhancedLogger";

const logger = createLogger("games-search");

export const MAX_QUERY_LENGTH = 100;
export const MAX_SEARCH_LIMIT = 50;

// Fewer substring matches than this means the local catalog probably lacks the game
const MIN_STRICT_MATCHES = 3;
// How long a query counts as "already searched in IGDB"
const IGDB_SEARCH_COOLDOWN = "7 days";
const IGDB_FRESH_SEARCH_COOLDOWN = "1 minute";

// In-process dedup: concurrent identical searches share one execution
const pendingSearches = new Map<string, Promise<SearchResult>>();

export interface SearchResult {
  results: ReturnType<typeof transformGameResponse>[];
  meta: {
    total: number;
    source: "none" | "database" | "igdb";
    query_time_ms?: number;
    deduplicated?: boolean;
  };
}

/** Escape LIKE wildcards so user input is matched literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const substringMatch = (name: Column, query: string) => ilike(name, `%${escapeLike(query)}%`);

// `%` is the pg_trgm similarity operator (threshold 0.3) and, unlike similarity(),
// can use the GIN trigram index
const fuzzyMatch = (name: Column, query: string) => sql`${name} % ${query}`;

// RQB filters receive the (aliased) table, so conditions are built per query
type GameFilter = (table: typeof game) => SQL;

const buildWhere =
  (queries: string[]): GameFilter =>
  (table) =>
    or(...queries.flatMap((q) => [substringMatch(table.name, q), fuzzyMatch(table.name, q)]))!;

const fetchGames = (rankQuery: string, where: GameFilter, limit: number, offset: number) =>
  db.query.game.findMany({
    where: { RAW: where },
    orderBy: (table) => [
      sql`similarity(${table.name}, ${rankQuery}) DESC`,
      desc(table.isPopular),
      sql`${table.totalRating} DESC NULLS LAST`,
    ],
    limit,
    offset,
    columns: GAME_CARD_COLUMNS,
    with: GAME_CARD_WITH,
  });

const countStrictMatches = async (queries: string[]) => {
  const [row] = await db
    .select({ value: count() })
    .from(game)
    .where(or(...queries.map((q) => substringMatch(game.name, q))));
  return row.value;
};

/**
 * Atomically claim the right to search IGDB for this query. Returns false when the
 * query was searched recently (by this or another backend instance).
 */
const claimIgdbSearch = async (query: string, forceFresh: boolean) => {
  const cooldown = forceFresh ? IGDB_FRESH_SEARCH_COOLDOWN : IGDB_SEARCH_COOLDOWN;
  const claimed = await db
    .insert(igdbSearchLog)
    .values({ query })
    .onConflictDoUpdate({
      target: igdbSearchLog.query,
      set: { searchedAt: sql`now()` },
      setWhere: sql`${igdbSearchLog.searchedAt} < now() - ${cooldown}::interval`,
    })
    .returning({ query: igdbSearchLog.query });
  return claimed.length > 0;
};

async function doSearch(
  query: string,
  limit: number,
  offset: number,
  forceFresh: boolean,
): Promise<SearchResult> {
  const startTime = Date.now();
  const cleanedQuery = query.replace(/[^\w\s]/gi, "").trim();
  const queries = cleanedQuery && cleanedQuery !== query ? [query, cleanedQuery] : [query];
  const where = buildWhere(queries);

  // Only the first page decides whether the catalog needs to grow
  const shouldAskIgdb =
    offset === 0 &&
    (forceFresh || (await countStrictMatches(queries)) < MIN_STRICT_MATCHES) &&
    (await claimIgdbSearch(query.toLowerCase(), forceFresh));

  if (shouldAskIgdb) {
    logger.info(`Delegating IGDB search to librarian for "${query}"`);
    try {
      const outcome = await requestIgdbSearch(query, MAX_SEARCH_LIMIT);
      if (outcome !== "notified") {
        logger.warn(`IGDB search for "${query}" finished with: ${outcome}`);
      }
    } catch (error) {
      // Serve whatever the local catalog has rather than failing the request
      logger.exception(error, { operation: "requestIgdbSearch", query });
    }
  }

  const games = await fetchGames(query, where, limit, offset);

  return {
    results: games.map(transformGameResponse),
    meta: {
      total: games.length,
      source: shouldAskIgdb ? "igdb" : "database",
      query_time_ms: Date.now() - startTime,
    },
  };
}

export async function searchGamesWithCache(
  searchQuery: string,
  limit: number = MAX_SEARCH_LIMIT,
  offset: number = 0,
  forceFresh: boolean = false,
): Promise<SearchResult> {
  const query = searchQuery?.trim().slice(0, MAX_QUERY_LENGTH) ?? "";
  if (query.length === 0) {
    return { results: [], meta: { total: 0, source: "none" } };
  }

  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_SEARCH_LIMIT);
  const safeOffset = Math.max(0, Math.trunc(offset));
  const dedupKey = `${query.toLowerCase()}:${safeLimit}:${safeOffset}:${forceFresh}`;

  const existing = pendingSearches.get(dedupKey);
  if (existing) {
    logger.info(`Deduplicating in-flight search for "${query}"`);
    const result = await existing;
    return { ...result, meta: { ...result.meta, deduplicated: true } };
  }

  const searchPromise = doSearch(query, safeLimit, safeOffset, forceFresh).finally(() => {
    pendingSearches.delete(dedupKey);
  });

  pendingSearches.set(dedupKey, searchPromise);
  return searchPromise;
}
