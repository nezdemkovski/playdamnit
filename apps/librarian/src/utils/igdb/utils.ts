import { createLogger } from "../enhancedLogger";
import { getIGDBToken, invalidateIGDBToken } from "./token";
import { transformIGDBResponse } from "./transformers";
import type { IGDBGameResponse } from "./types";

const logger = createLogger("igdb");

const IGDB_BASE_URL = "https://api.igdb.com/v4";

// IGDB game type IDs: 0=MAIN_GAME, 8=REMAKE, 9=REMASTER
const MAIN_GAME_TYPES = [0, 8, 9];

// IGDB allows 4 requests/second and 8 open requests per client
const MIN_REQUEST_INTERVAL_MS = 260;
const MAX_IDS_PER_REQUEST = 500;
export const MAX_SEARCH_QUERY_LENGTH = 100;

const GAME_FIELDS = `
  fields id, name, slug, created_at, genres.name, genres.slug,
         platforms.name, platforms.slug, platforms.abbreviation, first_release_date, keywords.name,
         cover.image_id, cover.width, cover.height,
         screenshots.image_id, screenshots.width, screenshots.height,
         websites.type.id, websites.type.type, websites.url, websites.trusted,
         game_modes.name, game_modes.slug, total_rating, total_rating_count,
         similar_games, storyline, summary,
         involved_companies.company.name, involved_companies.company.slug,
         game_type.id, game_type.type;`;

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

const igdbRequest = async <T>(endpoint: string, body: string, retryAuth = true): Promise<T> => {
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
    return igdbRequest<T>(endpoint, body, false);
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
) => {
  logger.info("Searching IGDB for:", { query, showOnlyGames });

  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_IDS_PER_REQUEST);
  let body = `search "${escapeApicalypseString(query)}";${GAME_FIELDS}`;
  if (showOnlyGames) {
    body += ` where game_type = (${MAIN_GAME_TYPES.join(",")});`;
  }
  body += ` limit ${safeLimit};`;

  const data = await igdbRequest<IGDBGameResponse[]>("games", body);
  return data.map(transformIGDBResponse);
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
    const rows = await igdbRequest<T[]>(endpoint, body);
    if (rows.length === 0) break;

    await onPage(rows);
    total += rows.length;
    lastId = rows[rows.length - 1].id;
    if (rows.length < MAX_IDS_PER_REQUEST) break;
  }

  return total;
};

/**
 * Fetch games by id, in batches of 500 (IGDB's max page size; the default is only 10).
 * Throws on failure so pg-boss can retry the job.
 */
export const fetchIGDBByIds = async (
  ids: number[],
  showOnlyGames: boolean = true,
): Promise<IGDBGameResponse[]> => {
  const validIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (validIds.length === 0) return [];

  logger.info(`Fetching games from IGDB by IDs`, { count: validIds.length });

  const results: IGDBGameResponse[] = [];

  for (let i = 0; i < validIds.length; i += MAX_IDS_PER_REQUEST) {
    const batch = validIds.slice(i, i + MAX_IDS_PER_REQUEST);
    let body = `${GAME_FIELDS} where id = (${batch.join(",")})`;
    if (showOnlyGames) {
      body += ` & game_type = (${MAIN_GAME_TYPES.join(",")})`;
    }
    body += `; limit ${batch.length};`;

    results.push(...(await igdbRequest<IGDBGameResponse[]>("games", body)));
  }

  return results;
};
