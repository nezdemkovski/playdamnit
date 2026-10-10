import { PgBoss } from "pg-boss";
import { asc, lt, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { game } from "@playdamnit/db/schema";
import { QUEUES, type FetchByIdsJob } from "@playdamnit/db/jobs";
import { createLogger } from "../utils/enhancedLogger";
import { SIMILAR_GAMES_MAX_DEPTH } from "./similarGamesWorker";

const logger = createLogger("refresh-worker");

const STALE_AFTER = "30 days";
const GAMES_PER_RUN = 1000;
const FETCH_BATCH_SIZE = 500;

/**
 * Re-fetch the stalest catalog entries so ratings, covers and popularity don't freeze
 * at the moment a game was first imported. Runs nightly via pg-boss cron.
 */
const refreshStaleGames = async (boss: PgBoss) => {
  const stale = await db
    .select({ id: game.id })
    .from(game)
    .where(lt(game.updatedAt, sql`now() - ${STALE_AFTER}::interval`))
    .orderBy(asc(game.updatedAt))
    .limit(GAMES_PER_RUN);

  const ids = stale.map((row) => row.id);

  for (let i = 0; i < ids.length; i += FETCH_BATCH_SIZE) {
    await boss.send(
      QUEUES.FETCH_BY_IDS,
      // Max depth: refreshing must not grow the catalog
      { ids: ids.slice(i, i + FETCH_BATCH_SIZE), depth: SIMILAR_GAMES_MAX_DEPTH } satisfies FetchByIdsJob,
      { retryLimit: 3, retryDelay: 60, retryBackoff: true }
    );
  }

  logger.info(`Queued refresh of ${ids.length} stale games`);
};

export const registerRefreshWorker = async (boss: PgBoss): Promise<void> => {
  await boss.work(QUEUES.REFRESH_STALE_GAMES, () => refreshStaleGames(boss));
  await boss.schedule(QUEUES.REFRESH_STALE_GAMES, "0 4 * * *");
};
