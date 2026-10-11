import { PgBoss, type Job } from "pg-boss";

import { db } from "@/db/postgres";
import { syncState } from "@playdamnit/db/schema";
import { QUEUES, type SyncCatalogCursor, type SyncCatalogJob } from "@playdamnit/db/jobs";
import { GAME_FIELDS, GAME_PAGE_SIZE, igdbQuery, isPayloadTooLarge } from "../utils/igdb/utils";
import type { IGDBGameResponse } from "../utils/igdb/types";
import { writeGamesBatch } from "../catalog/writeGames";
import { createLogger } from "../utils/enhancedLogger";

const logger = createLogger("catalog-sync");

// Pages per job run; the job re-enqueues itself with the cursor, so a run stays short and
// pg-boss's expiration never bites a multi-hour walk
const PAGES_PER_RUN = 20;
// Never shrink a page below this when IGDB keeps answering 413
const MIN_PAGE_SIZE = 10;
// Safety margin when seeding the incremental cursor from a finished full walk
const FULL_WALK_MARGIN_SECONDS = 60 * 60;

const JOB_OPTIONS = { retryLimit: 5, retryDelay: 60, retryBackoff: true, expireInSeconds: 1800 };

const stateKey = (mode: SyncCatalogJob["mode"]) => `catalog:${mode}`;

const loadCursor = async (mode: SyncCatalogJob["mode"]): Promise<SyncCatalogCursor | null> => {
  const row = await db.query.syncState.findFirst({ where: { entity: stateKey(mode) } });
  return row?.cursor ? (JSON.parse(row.cursor) as SyncCatalogCursor) : null;
};

const saveCursor = async (
  mode: SyncCatalogJob["mode"],
  cursor: SyncCatalogCursor | null,
  finished: boolean,
) => {
  const values = {
    entity: stateKey(mode),
    cursor: cursor ? JSON.stringify(cursor) : null,
    lastRunAt: finished ? new Date() : undefined,
  };
  await db
    .insert(syncState)
    .values({ ...values, lastRunAt: values.lastRunAt ?? null })
    .onConflictDoUpdate({
      target: syncState.entity,
      set: finished
        ? { cursor: values.cursor, lastRunAt: values.lastRunAt }
        : { cursor: values.cursor },
    });
};

interface Page {
  rows: IGDBGameResponse[];
  // The limit the page was fetched with: a shorter page means the walk is over
  limit: number;
}

/** One page of expanded games; shrinks the page while IGDB answers 413 (10 MB response cap). */
const fetchPage = async (where: string, sort: string, limit = GAME_PAGE_SIZE): Promise<Page> => {
  try {
    const rows = await igdbQuery<IGDBGameResponse[]>(
      "games",
      `${GAME_FIELDS} where ${where}; sort ${sort}; limit ${limit};`,
    );
    return { rows, limit };
  } catch (error) {
    if (!isPayloadTooLarge(error) || limit <= MIN_PAGE_SIZE) throw error;
    logger.warn(`IGDB page of ${limit} games too large, retrying with ${Math.floor(limit / 2)}`);
    return fetchPage(where, sort, Math.floor(limit / 2));
  }
};

/** Full walk: every game, by id. */
const fullStep = async (
  cursor: SyncCatalogCursor,
): Promise<{ cursor: SyncCatalogCursor; done: boolean }> => {
  let lastId = cursor.id ?? 0;
  for (let page = 0; page < PAGES_PER_RUN; page++) {
    const { rows, limit } = await fetchPage(`id > ${lastId}`, "id asc");
    if (rows.length === 0) return { cursor: { ...cursor, id: lastId }, done: true };
    await writeGamesBatch(rows);
    lastId = rows[rows.length - 1].id;
    if (rows.length < limit) return { cursor: { ...cursor, id: lastId }, done: true };
  }
  return { cursor: { ...cursor, id: lastId }, done: false };
};

/**
 * Incremental walk: games changed since the cursor, by updated_at. IGDB sorts on one field, so
 * a second with more than one page of updates is walked by id inside that second.
 */
const incrementalStep = async (
  cursor: SyncCatalogCursor,
): Promise<{ cursor: SyncCatalogCursor; done: boolean }> => {
  let { updatedAt = 0, updatedAtId } = cursor;
  for (let page = 0; page < PAGES_PER_RUN; page++) {
    const { rows, limit } =
      updatedAtId === undefined
        ? await fetchPage(`updated_at > ${updatedAt}`, "updated_at asc")
        : await fetchPage(`updated_at = ${updatedAt} & id > ${updatedAtId}`, "id asc");

    if (rows.length === 0) {
      if (updatedAtId === undefined)
        return { cursor: { ...cursor, updatedAt, updatedAtId }, done: true };
      // The crowded second is exhausted; continue after it
      updatedAtId = undefined;
      continue;
    }

    await writeGamesBatch(rows);
    const last = rows[rows.length - 1];
    const lastUpdatedAt = last.updated_at ?? updatedAt;

    if (updatedAtId !== undefined) {
      updatedAtId = last.id;
      if (rows.length < limit) updatedAtId = undefined;
    } else if (rows.length === limit && rows[0].updated_at === lastUpdatedAt) {
      // A full page within one second: switch to walking that second by id
      updatedAt = lastUpdatedAt;
      updatedAtId = last.id;
    } else {
      // Everything at the page's last second may continue on the next page; step back to it
      updatedAt = lastUpdatedAt - 1;
      if (rows.length < limit) {
        return {
          cursor: { ...cursor, updatedAt: lastUpdatedAt, updatedAtId: undefined },
          done: true,
        };
      }
    }
  }
  return { cursor: { ...cursor, updatedAt, updatedAtId }, done: false };
};

const handleSyncCatalog = async (boss: PgBoss, [job]: Job<SyncCatalogJob>[]) => {
  const { mode } = job.data;
  const stored = job.data.cursor ?? (await loadCursor(mode));

  if (mode === "incremental" && !stored?.updatedAt) {
    logger.warn("sync-catalog incremental has no cursor; run a full sync first");
    return;
  }

  const cursor: SyncCatalogCursor = {
    ...stored,
    startedAt: stored?.startedAt ?? Math.floor(Date.now() / 1000),
  };
  logger.info(`sync-catalog ${mode} step`, cursor);

  const result = mode === "full" ? await fullStep(cursor) : await incrementalStep(cursor);

  if (!result.done) {
    await saveCursor(mode, result.cursor, false);
    await boss.send(
      QUEUES.SYNC_CATALOG,
      { mode, cursor: result.cursor } satisfies SyncCatalogJob,
      JOB_OPTIONS,
    );
    return;
  }

  if (mode === "full") {
    // The walk is over: forget the id cursor and let incremental runs start from when it began
    await saveCursor("full", { startedAt: cursor.startedAt }, true);
    const incremental = await loadCursor("incremental");
    if (
      !incremental?.updatedAt ||
      incremental.updatedAt < cursor.startedAt! - FULL_WALK_MARGIN_SECONDS
    ) {
      await saveCursor(
        "incremental",
        { updatedAt: cursor.startedAt! - FULL_WALK_MARGIN_SECONDS },
        false,
      );
    }
  } else {
    await saveCursor(
      "incremental",
      { updatedAt: result.cursor.updatedAt, updatedAtId: undefined },
      true,
    );
  }
  logger.info(`sync-catalog ${mode} finished`, result.cursor);
};

export const registerCatalogSyncWorker = async (boss: PgBoss): Promise<void> => {
  await boss.work<SyncCatalogJob>(QUEUES.SYNC_CATALOG, async (jobs) => {
    try {
      await handleSyncCatalog(boss, jobs);
    } catch (error) {
      // pg-boss retries silently; make the failure visible in the logs
      logger.exception(error, { operation: "sync-catalog", data: jobs[0]?.data });
      throw error;
    }
  });
  // Daily delta; a full walk is started by hand (`bun run scripts/enqueue.ts sync-catalog full`)
  await boss.schedule(
    QUEUES.SYNC_CATALOG,
    "0 2 * * *",
    { mode: "incremental" } satisfies SyncCatalogJob,
    JOB_OPTIONS,
  );
};
