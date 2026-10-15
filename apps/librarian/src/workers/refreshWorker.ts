import { PgBoss } from "pg-boss";
import { asc, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { game } from "@playdamnit/db/schema";
import { QUEUES, type FetchByIdsJob } from "@playdamnit/db/jobs";
import { createLogger } from "../utils/enhancedLogger";
import { Schedule, LogNamespace } from "../utils/enums";
import { reported } from "./reported";

const logger = createLogger(LogNamespace.RefreshWorker);

const STALE_AFTER = "30 days";
const GAMES_PER_RUN = 1000;
const FETCH_BATCH_SIZE = 500;

/**
 * Safety net under webhooks and the daily incremental sync: re-fetch the catalog entries that
 * haven't been synced for a month. Games IGDB no longer returns are not touched here; the
 * webhook drain flags those.
 */
const refreshStaleGames = async (boss: PgBoss) => {
  const stale = await db
    .select({ id: game.id })
    .from(game)
    .where(
      or(isNull(game.lastSyncedAt), lt(game.lastSyncedAt, sql`now() - ${STALE_AFTER}::interval`)),
    )
    .orderBy(asc(game.lastSyncedAt))
    .limit(GAMES_PER_RUN);

  const ids = stale.map((row) => row.id);

  for (let i = 0; i < ids.length; i += FETCH_BATCH_SIZE) {
    await boss.send(
      QUEUES.FETCH_BY_IDS,
      { ids: ids.slice(i, i + FETCH_BATCH_SIZE) } satisfies FetchByIdsJob,
      { retryLimit: 3, retryDelay: 60, retryBackoff: true },
    );
  }

  logger.info(`Queued refresh of ${ids.length} stale games`);
};

export const registerRefreshWorker = async (boss: PgBoss): Promise<void> => {
  await boss.work(
    QUEUES.REFRESH_STALE_GAMES,
    reported(QUEUES.REFRESH_STALE_GAMES, () => refreshStaleGames(boss)),
  );
  await boss.schedule(QUEUES.REFRESH_STALE_GAMES, Schedule.RefreshStaleGames);
};
