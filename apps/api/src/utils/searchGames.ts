import { and, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db/postgres";
import { game } from "@playdamnit/db/schema";
import { GAME_CARD_COLUMNS, GAME_CARD_WITH, transformGameResponse } from "@/utils/gameTransformers";

export const MAX_QUERY_LENGTH = 100;
export const MAX_SEARCH_LIMIT = 50;

interface SearchOptions {
  limit?: number;
  offset?: number;
  // Editions (`version_parent` set) are folded into their parent and hidden by default
  includeEditions?: boolean;
  // IGDB game_type ids to keep (0 = Main Game, 1 = DLC, ...); empty = every type
  gameTypes?: number[];
}

interface SearchResult {
  results: ReturnType<typeof transformGameResponse>[];
  meta: {
    total: number;
    source: "none" | "database";
    query_time_ms?: number;
  };
}

/** Escape LIKE wildcards so user input is matched literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

type GameTable = typeof game;

// `search_names` is the name plus every alternative name (so "Киберпанк" finds Cyberpunk 2077).
// Substring match, or pg_trgm word similarity (`<%`, threshold 0.6) for typos; both use the GIN
// trigram index on search_names. Case folding and trigrams of non-Latin scripts need a database
// whose LC_CTYPE is UTF-8 aware (production: builtin C.UTF-8 provider, lc_ctype C.UTF-8).
const matches = (table: GameTable, query: string): SQL =>
  or(ilike(table.searchNames, `%${escapeLike(query)}%`), sql`${query} <% ${table.searchNames}`)!;

const buildWhere =
  (queries: string[], opts: SearchOptions) =>
  (table: GameTable): SQL =>
    and(
      isNull(table.deletedAt),
      opts.includeEditions ? undefined : isNull(table.versionParentId),
      opts.gameTypes?.length ? inArray(table.gameType, opts.gameTypes) : undefined,
      or(...queries.map((q) => matches(table, q))),
    )!;

/**
 * Relevance, highest first:
 * - 1 when the query is exactly the name or one of the alternative names ("gta 5", "botw");
 * - strict word similarity against all names, so "witcher 3" prefers "The Witcher 3: Wild Hunt"
 *   over the shorter "The Witcher" (plain similarity favours short names);
 * - plain similarity to the main name, so "the witcher" still puts "The Witcher" first;
 * - popularity, log-scaled IGDB rating count, which breaks ties on broad queries ("mario").
 * Weights were tuned against the production catalog.
 */
const relevance = (table: GameTable, query: string): SQL => sql`(
  case when lower(${table.name}) = ${query}
    or exists (select 1 from unnest(${table.alternativeNames}) as alt(n) where lower(alt.n) = ${query})
  then 1 else 0 end
  + 0.6 * strict_word_similarity(${query}, ${table.searchNames})
  + 0.4 * similarity(${table.name}, ${query})
  + 0.3 * ln(1 + coalesce(${table.totalRatingCount}, 0)) / ln(10001)
)`;

const fetchGames = (
  rankQuery: string,
  where: (table: GameTable) => SQL,
  limit: number,
  offset: number,
) =>
  db.query.game.findMany({
    where: { RAW: where },
    orderBy: (table) => [
      sql`${relevance(table, rankQuery)} DESC`,
      sql`${table.totalRatingCount} DESC NULLS LAST`,
      table.id,
    ],
    limit,
    offset,
    columns: GAME_CARD_COLUMNS,
    with: GAME_CARD_WITH,
  });

export async function searchGames(
  searchQuery: string,
  opts: SearchOptions = {},
): Promise<SearchResult> {
  // Lower-cased once here; exact-name matching compares against lower() of the columns
  const query = searchQuery?.trim().slice(0, MAX_QUERY_LENGTH).toLowerCase() ?? "";
  if (query.length === 0) {
    return { results: [], meta: { total: 0, source: "none" } };
  }

  const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? MAX_SEARCH_LIMIT)), MAX_SEARCH_LIMIT);
  const offset = Math.max(0, Math.trunc(opts.offset ?? 0));
  const startTime = Date.now();

  // Punctuation stripped (letters and digits of any script kept): "half-life" also tries "halflife"
  const cleanedQuery = query.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const queries = cleanedQuery && cleanedQuery !== query ? [query, cleanedQuery] : [query];

  const games = await fetchGames(query, buildWhere(queries, opts), limit, offset);

  return {
    results: games.map(transformGameResponse),
    meta: { total: games.length, source: "database", query_time_ms: Date.now() - startTime },
  };
}
