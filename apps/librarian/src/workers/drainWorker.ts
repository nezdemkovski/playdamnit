import { PgBoss } from "pg-boss";
import { and, asc, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/postgres";
import { catalogDirty, game } from "@playdamnit/db/schema";
import { QUEUES } from "@playdamnit/db/jobs";
import { fetchIGDBByIds } from "../utils/igdb/utils";
import { writeGamesBatch } from "../catalog/writeGames";
import { createLogger } from "../utils/enhancedLogger";

const logger = createLogger("drain-worker");

const DELETED_REASON = "deleted";
const BATCH_SIZE = 500;
// Rounds per run; a backlog bigger than this waits for the next minute
const MAX_ROUNDS = 10;

/**
 * One round: claim up to BATCH_SIZE dirty rows (skipping ones another drain holds), fetch the
 * games IGDB still has, flag the rest as deleted, and only then remove the claims. The claims
 * stay locked until commit, so a failed IGDB call leaves them for the next run.
 */
const drainRound = async (): Promise<{ claimed: number; written: number; flagged: number }> =>
  db.transaction(async (tx) => {
    const rows = await tx
      .select({ igdbId: catalogDirty.igdbId, reason: catalogDirty.reason })
      .from(catalogDirty)
      .orderBy(asc(catalogDirty.markedAt))
      .limit(BATCH_SIZE)
      .for("update", { skipLocked: true });

    if (rows.length === 0) return { claimed: 0, written: 0, flagged: 0 };

    const deletedIds = rows.filter((row) => row.reason === DELETED_REASON).map((row) => row.igdbId);
    const fetchIds = rows.filter((row) => row.reason !== DELETED_REASON).map((row) => row.igdbId);

    let written = 0;
    let missing: number[] = [];
    if (fetchIds.length > 0) {
      const games = await fetchIGDBByIds(fetchIds, false);
      written = await writeGamesBatch(games);
      const found = new Set(games.map((g) => g.id));
      missing = fetchIds.filter((id) => !found.has(id));
    }

    const gone = [...new Set([...deletedIds, ...missing])];
    if (gone.length > 0) {
      await tx
        .update(game)
        .set({ deletedAt: new Date() })
        .where(and(inArray(game.id, gone), isNull(game.deletedAt)));
    }

    await tx.delete(catalogDirty).where(
      inArray(
        catalogDirty.igdbId,
        rows.map((row) => row.igdbId),
      ),
    );

    return { claimed: rows.length, written, flagged: gone.length };
  });

const drainDirty = async () => {
  const total = { claimed: 0, written: 0, flagged: 0 };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await drainRound();
    total.claimed += result.claimed;
    total.written += result.written;
    total.flagged += result.flagged;
    if (result.claimed < BATCH_SIZE) break;
  }
  if (total.claimed > 0) logger.info("drain-dirty done", total);
  return total;
};

export const registerDrainWorker = async (boss: PgBoss): Promise<void> => {
  await boss.work(QUEUES.DRAIN_DIRTY, async () => {
    try {
      await drainDirty();
    } catch (error) {
      logger.exception(error, { operation: "drain-dirty" });
      throw error;
    }
  });
  await boss.schedule(QUEUES.DRAIN_DIRTY, "* * * * *");
};
