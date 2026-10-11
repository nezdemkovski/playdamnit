import { createLogger } from "../enhancedLogger";
import { getIGDBToken, invalidateIGDBToken } from "./token";
import type { IGDBGameResponse } from "./types";

const logger = createLogger("igdb");

const IGDB_BASE_URL = "https://api.igdb.com/v4";

// IGDB game type IDs: 0=MAIN_GAME, 8=REMAKE, 9=REMASTER
const MAIN_GAME_TYPES = [0, 8, 9];

// IGDB allows 4 requests/second and 8 open requests per client
const MIN_REQUEST_INTERVAL_MS = 260;
export const MAX_IDS_PER_REQUEST = 500;
export const MAX_SEARCH_QUERY_LENGTH = 100;

// The whole game document with every relation we store expanded one level (two for the
// company and cover sub-objects). `*` covers the scalar fields and plain reference ids
// (parent_game, version_parent, similar_games, updated_at, ...).
export const GAME_FIELDS = `
  fields *, alternative_names.*, cover.*, screenshots.*, videos.*, websites.*, websites.type.*,
         external_games.*, involved_companies.*, involved_companies.company.*,
         game_localizations.*, game_localizations.cover.*, release_dates.*,
         genres.*, platforms.*, game_modes.*, themes.*, collections.*, game_type.*, keywords.*;`;

export class IGDBError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "IGDBError";
  }
}

// Serialises request starts so the whole process stays under IGDB's rate limit
let nextSlot = 0;
const throttle = async () => {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_REQUEST_INTERVAL_MS;
  if (wait > 0) await Bun.sleep(wait);
};

/** One throttled, authenticated IGDB request. Throws IGDBError on non-2xx. */
export const igdbQuery = async <T>(
  endpoint: string,
  body: string,
  retryAuth = true,
): Promise<T> => {
  await throttle();

  const response = await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID ?? "",
      Authorization: await getIGDBToken(),
      "Content-Type": "text/plain",
    },
    body,
  });

  if (response.status === 401 && retryAuth) {
    invalidateIGDBToken();
    return igdbQuery<T>(endpoint, body, false);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new IGDBError(
      `IGDB request failed with ${response.status}: ${errorText.slice(0, 500)}`,
      response.status,
    );
  }

  return (await response.json()) as T;
};

/**
 * Escape a user-supplied string for an Apicalypse string literal, so it can't
 * close the literal and inject clauses.
 */
export const escapeApicalypseString = (value: string) =>
  value
    .slice(0, MAX_SEARCH_QUERY_LENGTH)
    // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

/**
 * Search IGDB. Throws on failure so pg-boss can retry the job.
 */
export const searchIGDB = async (
  query: string,
  showOnlyGames: boolean = true,
  limit: number = 50,
): Promise<IGDBGameResponse[]> => {
  logger.info("Searching IGDB for:", { query, showOnlyGames });

  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_IDS_PER_REQUEST);
  let body = `search "${escapeApicalypseString(query)}";${GAME_FIELDS}`;
  if (showOnlyGames) {
    body += ` where game_type = (${MAIN_GAME_TYPES.join(",")});`;
  }
  body += ` limit ${safeLimit};`;

  return igdbQuery<IGDBGameResponse[]>("games", body);
};

/**
 * Walk a whole IGDB endpoint with keyset pagination (`id > last; sort id asc`), 500 rows per
 * request, handing every page to `onPage`. Returns the number of rows seen. Throws on failure
 * so pg-boss can retry the job.
 */
export const fetchAllIGDB = async <T extends { id: number }>(
  endpoint: string,
  fields: string,
  onPage: (rows: T[]) => Promise<void>,
  opts: { where?: string; afterId?: number } = {},
): Promise<number> => {
  // Some lookup tables start at id 0 (game_types: 0 = Main Game), so the walk starts below it
  let lastId = opts.afterId ?? -1;
  let total = 0;

  for (;;) {
    const where = [`id > ${lastId}`, opts.where].filter(Boolean).join(" & ");
    const body = `fields ${fields}; where ${where}; sort id asc; limit ${MAX_IDS_PER_REQUEST};`;
    const rows = await igdbQuery<T[]>(endpoint, body);
    if (rows.length === 0) break;

    await onPage(rows);
    total += rows.length;
    lastId = rows[rows.length - 1].id;
    if (rows.length < MAX_IDS_PER_REQUEST) break;
  }

  return total;
};

// IGDB caps a response at 10 MB; a full game document averages ~35 KB, so a page of
// expanded games has to be far below the 500-row limit
export const GAME_PAGE_SIZE = 100;

/** IGDB answered 413: the page was too big for the 10 MB response limit. */
export const isPayloadTooLarge = (error: unknown) =>
  error instanceof IGDBError && error.status === 413;

/**
 * Fetch games by id, in pages of GAME_PAGE_SIZE. A page that still exceeds IGDB's response
 * limit is split in half and retried. Throws on other failures so pg-boss can retry the job.
 */
export const fetchIGDBByIds = async (
  ids: number[],
  showOnlyGames: boolean = true,
): Promise<IGDBGameResponse[]> => {
  const validIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (validIds.length === 0) return [];

  logger.info(`Fetching games from IGDB by IDs`, { count: validIds.length });

  const fetchBatch = async (batch: number[]): Promise<IGDBGameResponse[]> => {
    let body = `${GAME_FIELDS} where id = (${batch.join(",")})`;
    if (showOnlyGames) {
      body += ` & game_type = (${MAIN_GAME_TYPES.join(",")})`;
    }
    body += `; limit ${batch.length};`;

    try {
      return await igdbQuery<IGDBGameResponse[]>("games", body);
    } catch (error) {
      if (!isPayloadTooLarge(error) || batch.length < 2) throw error;
      const half = Math.ceil(batch.length / 2);
      return [
        ...(await fetchBatch(batch.slice(0, half))),
        ...(await fetchBatch(batch.slice(half))),
      ];
    }
  };

  const results: IGDBGameResponse[] = [];
  for (let i = 0; i < validIds.length; i += GAME_PAGE_SIZE) {
    results.push(...(await fetchBatch(validIds.slice(i, i + GAME_PAGE_SIZE))));
  }

  return results;
};
