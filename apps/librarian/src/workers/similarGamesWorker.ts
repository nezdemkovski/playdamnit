import { PgBoss, type Job } from "pg-boss";
import { inArray } from "drizzle-orm";

import { db } from "@/db/postgres";
import { game, gameToSimilarGame } from "@playdamnit/db/schema";
import { QUEUES, type FetchByIdsJob, type ProcessSimilarGamesJob } from "@playdamnit/db/jobs";
import { createLogger } from "../utils/enhancedLogger";

const logger = createLogger("similar-games-worker");

const FETCH_BATCH_SIZE = 100;

// How many similar-games hops away from a user request the catalog may grow.
// 1 = games users asked for get their similar games fetched, and it stops there.
export const SIMILAR_GAMES_MAX_DEPTH = Number(process.env.SIMILAR_GAMES_MAX_DEPTH ?? 1);

const handleSimilarGames = async (boss: PgBoss, [job]: Job<ProcessSimilarGamesJob>[]) => {
  const { gameId, similarGameIds, depth = 0 } = job.data;

  const validIds = [...new Set(similarGameIds ?? [])].filter(
    (id) => Number.isInteger(id) && id > 0 && id !== gameId,
  );
  if (!gameId || validIds.length === 0) return;

  const existingIds = new Set(
    (await db.select({ id: game.id }).from(game).where(inArray(game.id, validIds))).map(
      (g) => g.id,
    ),
  );
  const missingIds = validIds.filter((id) => !existingIds.has(id));

  // Missing games get linked when they arrive: their own similar-games job links back
  const nextDepth = depth + 1;
  if (missingIds.length > 0 && nextDepth <= SIMILAR_GAMES_MAX_DEPTH) {
    logger.info(
      `Fetching ${missingIds.length} missing similar games of ${gameId} (depth ${nextDepth})`,
    );
    for (let i = 0; i < missingIds.length; i += FETCH_BATCH_SIZE) {
      await boss.send(
        QUEUES.FETCH_BY_IDS,
        {
          ids: missingIds.slice(i, i + FETCH_BATCH_SIZE),
          depth: nextDepth,
        } satisfies FetchByIdsJob,
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
      );
    }
  }

  if (existingIds.size > 0) {
    const pairs = [...existingIds].flatMap((similarGameId) => [
      { gameId, similarGameId },
      { gameId: similarGameId, similarGameId: gameId },
    ]);
    await db.insert(gameToSimilarGame).values(pairs).onConflictDoNothing();
  }
};

export const registerSimilarGamesWorker = async (boss: PgBoss): Promise<void> => {
  await boss.work<ProcessSimilarGamesJob>(
    QUEUES.PROCESS_SIMILAR_GAMES,
    { localConcurrency: 5 },
    (jobs) => handleSimilarGames(boss, jobs),
  );
};
