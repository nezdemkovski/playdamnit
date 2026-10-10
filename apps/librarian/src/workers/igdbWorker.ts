import { PgBoss, type Job } from "pg-boss";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import {
  game,
  cover,
  screenshot,
  website,
  websiteType,
  platform,
  genre,
  gameMode,
  type,
  gameToPlatform,
  gameToGenre,
  gameToGameMode,
  gameToType,
  ImageSourceEnum,
} from "@playdamnit/db/schema";
import {
  NOTIFY_CHANNEL,
  QUEUES,
  type CatalogUpdatedPayload,
  type FetchByIdsJob,
  type ProcessSimilarGamesJob,
  type SearchIgdbJob,
} from "@playdamnit/db/jobs";
import { searchIGDB, fetchIGDBByIds } from "../utils/igdb/utils";
import { transformIGDBResponse } from "../utils/igdb/transformers";
import { createLogger } from "../utils/enhancedLogger";

const logger = createLogger("igdb-worker");

type CatalogGame = ReturnType<typeof transformIGDBResponse>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const JOB_OPTIONS = { retryLimit: 3, retryDelay: 30, retryBackoff: true };

// Workers poll for new jobs; a user may be waiting on these two queues
const INTERACTIVE_POLLING = { pollingIntervalSeconds: 0.5 };

export const sendNotify = async (requestId: string, ok: boolean): Promise<void> => {
  try {
    const payload: CatalogUpdatedPayload = { requestId, ok };
    await db.execute(sql`select pg_notify(${NOTIFY_CHANNEL}, ${JSON.stringify(payload)})`);
  } catch (error) {
    logger.exception(error, { operation: "sendNotify", requestId });
  }
};

// ON CONFLICT DO UPDATE fails if one statement hits the same key twice
const uniqueBy = <T>(items: T[], key: (item: T) => string) =>
  [...new Map(items.map((item) => [key(item), item])).values()];

/**
 * Upsert lookup rows (platforms, genres, ...) by their unique key and return their ids.
 */
const upsertLookup = async <T extends { id: number }>(
  run: () => Promise<T[]>
): Promise<number[]> => (await run()).map((row) => row.id);

const writeGame = async (tx: Tx, gameData: CatalogGame) => {
  const gameValues = {
    name: gameData.name,
    slug: gameData.slug,
    summary: gameData.summary,
    storyline: gameData.storyline,
    firstReleaseDate: gameData.first_release_date,
    totalRating: gameData.total_rating,
    involvedCompanies: gameData.involved_companies,
    keywords: gameData.keywords,
    isPopular: gameData.isPopular,
  };

  // Existing games are refreshed with the latest IGDB data
  await tx
    .insert(game)
    .values({ id: gameData.id, ...gameValues })
    .onConflictDoUpdate({
      target: game.id,
      set: { ...gameValues, updatedAt: sql`now()` },
    });

  if (gameData.cover) {
    const coverValues = {
      hash: gameData.cover.hash,
      source: ImageSourceEnum.IGDB,
      width: gameData.cover.width,
      height: gameData.cover.height,
    };
    await tx
      .insert(cover)
      .values({ gameId: gameData.id, ...coverValues })
      .onConflictDoUpdate({ target: cover.gameId, set: coverValues });
  } else {
    await tx.delete(cover).where(eq(cover.gameId, gameData.id));
  }

  await tx.delete(screenshot).where(eq(screenshot.gameId, gameData.id));
  if (gameData.screenshots?.length) {
    await tx.insert(screenshot).values(
      gameData.screenshots.map((ss) => ({
        gameId: gameData.id,
        hash: ss.hash,
        source: ImageSourceEnum.IGDB,
        width: ss.width,
        height: ss.height,
      }))
    );
  }

  await tx.delete(website).where(eq(website.gameId, gameData.id));
  if (gameData.websites?.length) {
    const typeNames = [
      ...new Set(gameData.websites.map((ws) => ws.type).filter((t): t is string => !!t)),
    ];
    const typeIds = new Map<string, number>();
    if (typeNames.length) {
      const rows = await tx
        .insert(websiteType)
        .values(typeNames.map((t) => ({ type: t })))
        .onConflictDoUpdate({ target: websiteType.type, set: { type: sql`excluded.type` } })
        .returning({ id: websiteType.id, type: websiteType.type });
      for (const row of rows) typeIds.set(row.type, row.id);
    }

    await tx.insert(website).values(
      gameData.websites.map((ws) => ({
        gameId: gameData.id,
        url: ws.url,
        trusted: ws.trusted || false,
        typeId: ws.type ? (typeIds.get(ws.type) ?? null) : null,
      }))
    );
  }

  const platformIds = gameData.platforms?.length
    ? await upsertLookup(() =>
        tx
          .insert(platform)
          .values(uniqueBy(gameData.platforms!, (p) => p.slug).map((p) => ({ name: p.name, slug: p.slug })))
          .onConflictDoUpdate({ target: platform.slug, set: { name: sql`excluded.name` } })
          .returning({ id: platform.id })
      )
    : [];

  const genreIds = gameData.genres?.length
    ? await upsertLookup(() =>
        tx
          .insert(genre)
          .values(uniqueBy(gameData.genres!, (g) => g.slug).map((g) => ({ name: g.name, slug: g.slug })))
          .onConflictDoUpdate({ target: genre.slug, set: { name: sql`excluded.name` } })
          .returning({ id: genre.id })
      )
    : [];

  const gameModeIds = gameData.game_modes?.length
    ? await upsertLookup(() =>
        tx
          .insert(gameMode)
          .values(uniqueBy(gameData.game_modes!, (gm) => gm.slug).map((gm) => ({ name: gm.name, slug: gm.slug })))
          .onConflictDoUpdate({ target: gameMode.slug, set: { name: sql`excluded.name` } })
          .returning({ id: gameMode.id })
      )
    : [];

  const typeIds = gameData.game_types?.length
    ? await upsertLookup(() =>
        tx
          .insert(type)
          .values(uniqueBy(gameData.game_types!, (gt) => gt.type).map((gt) => ({ type: gt.type })))
          .onConflictDoUpdate({ target: type.type, set: { type: sql`excluded.type` } })
          .returning({ id: type.id })
      )
    : [];

  await tx.delete(gameToPlatform).where(eq(gameToPlatform.gameId, gameData.id));
  if (platformIds.length) {
    await tx
      .insert(gameToPlatform)
      .values(platformIds.map((platformId) => ({ gameId: gameData.id, platformId })))
      .onConflictDoNothing();
  }

  await tx.delete(gameToGenre).where(eq(gameToGenre.gameId, gameData.id));
  if (genreIds.length) {
    await tx
      .insert(gameToGenre)
      .values(genreIds.map((genreId) => ({ gameId: gameData.id, genreId })))
      .onConflictDoNothing();
  }

  await tx.delete(gameToGameMode).where(eq(gameToGameMode.gameId, gameData.id));
  if (gameModeIds.length) {
    await tx
      .insert(gameToGameMode)
      .values(gameModeIds.map((gameModeId) => ({ gameId: gameData.id, gameModeId })))
      .onConflictDoNothing();
  }

  await tx.delete(gameToType).where(eq(gameToType.gameId, gameData.id));
  if (typeIds.length) {
    await tx
      .insert(gameToType)
      .values(typeIds.map((typeId) => ({ gameId: gameData.id, typeId })))
      .onConflictDoNothing();
  }
};

/**
 * Upsert a batch of transformed IGDB games and enqueue the similar-games step for each.
 * Every game is written in its own transaction so one bad record doesn't sink the batch.
 */
export const writeGamesBatch = async (
  boss: PgBoss,
  games: CatalogGame[],
  depth: number
): Promise<number> => {
  let written = 0;

  for (const gameData of games) {
    try {
      await db.transaction((tx) => writeGame(tx, gameData));
      written++;
    } catch (error) {
      logger.exception(error, {
        operation: "writeGamesBatch:writeGame",
        gameId: gameData.id,
        gameName: gameData.name,
      });
      continue;
    }

    if (gameData.similar_games?.length) {
      await boss.send(
        QUEUES.PROCESS_SIMILAR_GAMES,
        {
          gameId: gameData.id,
          similarGameIds: gameData.similar_games,
          depth,
        } satisfies ProcessSimilarGamesJob,
        JOB_OPTIONS
      );
    }
  }

  logger.info(`writeGamesBatch: ${written}/${games.length} games written`);
  return written;
};

/**
 * Run a job and always tell a waiting backend request how it went. On failure the
 * error is rethrown so pg-boss retries the job; the backend stops waiting either way.
 */
const withNotify = async (requestId: string | undefined, run: () => Promise<void>) => {
  try {
    await run();
    if (requestId) await sendNotify(requestId, true);
  } catch (error) {
    if (requestId) await sendNotify(requestId, false);
    throw error;
  }
};

const handleSearch = async (boss: PgBoss, [job]: Job<SearchIgdbJob>[]) => {
  const { query, limit, requestId } = job.data;
  logger.info(`Processing search-igdb job for query: "${query}"`);

  await withNotify(requestId, async () => {
    let results = await searchIGDB(query, true, limit);

    if (results.length === 0) {
      const cleanedQuery = query.replace(/[^\w\s]/gi, "").trim();
      if (cleanedQuery && cleanedQuery !== query) {
        results = await searchIGDB(cleanedQuery, true, limit);
      }
    }

    await writeGamesBatch(boss, results, 0);
    logger.info(`search-igdb done: ${results.length} games for "${query}"`);
  });
};

const handleFetchByIds = async (boss: PgBoss, [job]: Job<FetchByIdsJob>[]) => {
  const { ids, requestId, depth = 0 } = job.data;
  logger.info(`Processing fetch-by-ids job for ${ids.length} IDs (depth ${depth})`);

  await withNotify(requestId, async () => {
    const igdbGames = await fetchIGDBByIds(ids, false);
    const written = await writeGamesBatch(boss, igdbGames.map(transformIGDBResponse), depth);
    logger.info(`fetch-by-ids done: ${written} games written`);
  });
};

export const registerIgdbWorkers = async (boss: PgBoss): Promise<void> => {
  await boss.work<SearchIgdbJob>(QUEUES.SEARCH_IGDB, INTERACTIVE_POLLING, (jobs) =>
    handleSearch(boss, jobs)
  );
  await boss.work<FetchByIdsJob>(QUEUES.FETCH_BY_IDS, INTERACTIVE_POLLING, (jobs) =>
    handleFetchByIds(boss, jobs)
  );
};
