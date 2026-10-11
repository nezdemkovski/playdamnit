import { PgBoss, type Job } from "pg-boss";
import { sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import {
  NOTIFY_CHANNEL,
  QUEUES,
  type CatalogUpdatedPayload,
  type FetchByIdsJob,
} from "@playdamnit/db/jobs";
import { fetchIGDBByIds } from "../utils/igdb/utils";
import { writeGamesBatch } from "../catalog/writeGames";
import { createLogger } from "../utils/enhancedLogger";

const logger = createLogger("igdb-worker");

// Workers poll for new jobs; a user (import, add by id) may be waiting on this queue
const INTERACTIVE_POLLING = { pollingIntervalSeconds: 0.5 };

export const sendNotify = async (requestId: string, ok: boolean): Promise<void> => {
  try {
    const payload: CatalogUpdatedPayload = { requestId, ok };
    await db.execute(sql`select pg_notify(${NOTIFY_CHANNEL}, ${JSON.stringify(payload)})`);
  } catch (error) {
    logger.exception(error, { operation: "sendNotify", requestId });
  }
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

const handleFetchByIds = async ([job]: Job<FetchByIdsJob>[]) => {
  const { ids, requestId } = job.data;
  logger.info(`Processing fetch-by-ids job for ${ids.length} IDs`);

  await withNotify(requestId, async () => {
    const igdbGames = await fetchIGDBByIds(ids, false);
    const written = await writeGamesBatch(igdbGames);
    logger.info(`fetch-by-ids done: ${written} games written`);
  });
};

export const registerIgdbWorkers = async (boss: PgBoss): Promise<void> => {
  await boss.work<FetchByIdsJob>(QUEUES.FETCH_BY_IDS, INTERACTIVE_POLLING, handleFetchByIds);
};
