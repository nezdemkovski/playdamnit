import { createLogger } from "../enhancedLogger";
import { getIGDBToken, invalidateIGDBToken } from "./token";
import type { IGDBGameResponse } from "./types";
import { HttpHeader, HttpMethod, MimeType, LogNamespace } from "../enums";

const logger = createLogger(LogNamespace.Igdb);

const IGDB_BASE_URL = "https://api.igdb.com/v4";

// IGDB game type IDs: 0=MAIN_GAME, 8=REMAKE, 9=REMASTER
const MAIN_GAME_TYPES = [0, 8, 9];

// IGDB allows 4 requests/second and 8 open requests per client
const MIN_REQUEST_INTERVAL_MS = 260;
const MAX_IDS_PER_REQUEST = 500;

// The whole game document with every relation we store expanded one level (two for the
// company and cover sub-objects). `*` covers the scalar fields and plain reference ids
// (parent_game, version_parent, similar_games, updated_at, ...).
export const GAME_FIELDS = `
  fields *, alternative_names.*, cover.*, screenshots.*, videos.*, websites.*, websites.type.*,
         external_games.*, involved_companies.*, involved_companies.company.*,
         game_localizations.*, game_localizations.cover.*, release_dates.*,
         genres.*, platforms.*, game_modes.*, themes.*, collections.*, game_type.*, keywords.*;`;

class IGDBError extends Error {
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

// 429 / transient 5xx / network errors: wait and try again this many times before giving up
const MAX_TRANSIENT_RETRIES = 3;
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

const isTransientStatus = (status: number) => TRANSIENT_STATUSES.has(status);

/** Seconds IGDB asked us to wait (Retry-After), or a growing default. */
const retryDelayMs = (response: Response | null, attempt: number) => {
  const header = Number(response?.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header, 60) * 1000;
  return 1000 * 2 ** attempt;
};

/** Hold every caller back, not just the one that got the 429 */
const pauseThrottle = (ms: number) => {
  nextSlot = Math.max(nextSlot, Date.now() + ms);
};

/**
 * Core of every IGDB call: throttled, authenticated, retried on 401 (new token), 429 and
 * transient 5xx/network failures. Throws IGDBError once the retries are spent.
 */
const igdbRequest = async (
  method: HttpMethod,
  path: string,
  init: { body?: string | URLSearchParams; contentType?: string },
): Promise<Response> => {
  let retryAuth = true;
  for (let attempt = 0; ; attempt++) {
    await throttle();

    let response: Response | null = null;
    try {
      response = await fetch(`${IGDB_BASE_URL}/${path}`, {
        method,
        headers: {
          [HttpHeader.ClientId]: process.env.TWITCH_CLIENT_ID ?? "",
          [HttpHeader.Authorization]: await getIGDBToken(),
          ...(init.contentType && { [HttpHeader.ContentType]: init.contentType }),
        },
        ...(init.body !== undefined && { body: init.body }),
      });
    } catch (error) {
      if (attempt >= MAX_TRANSIENT_RETRIES) throw error;
      const wait = retryDelayMs(null, attempt);
      logger.warn(`IGDB ${method} ${path}: network error, retrying in ${wait}ms`, {
        error: String(error),
      });
      await Bun.sleep(wait);
      continue;
    }

    if (response.status === 401 && retryAuth) {
      retryAuth = false;
      invalidateIGDBToken();
      continue;
    }

    if (isTransientStatus(response.status) && attempt < MAX_TRANSIENT_RETRIES) {
      const wait = retryDelayMs(response, attempt);
      if (response.status === 429) pauseThrottle(wait);
      logger.warn(`IGDB ${method} ${path} answered ${response.status}, retrying in ${wait}ms`);
      await response.text().catch(() => undefined);
      await Bun.sleep(wait);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new IGDBError(
        `IGDB ${method} ${path} failed with ${response.status}: ${errorText.slice(0, 500)}`,
        response.status,
      );
    }

    return response;
  }
};

/** An Apicalypse query against an endpoint. */
export const igdbQuery = async <T>(endpoint: string, body: string): Promise<T> =>
  (
    await igdbRequest(HttpMethod.Post, endpoint, { body, contentType: MimeType.PlainText })
  ).json() as Promise<T>;

/** Any other authenticated IGDB call (webhook management): GET/DELETE, or a form-encoded POST. */
export const igdbFetch = (method: HttpMethod, path: string, form?: URLSearchParams) =>
  igdbRequest(method, path, {
    body: form,
    contentType: form ? MimeType.FormUrlEncoded : undefined,
  });

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
