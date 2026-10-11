import { inArray } from "drizzle-orm";

import { db } from "@/db/postgres";
import { game } from "@playdamnit/db/schema";
import { QUEUES, type FetchByIdsJob } from "@playdamnit/db/jobs";
import { getBoss } from "@/utils/pgBoss";
import { waitForNotify, type NotifyResult } from "@/utils/pgNotify";

const JOB_OPTIONS = { retryLimit: 3, retryDelay: 5, retryBackoff: true };

/**
 * Enqueue a librarian job and wait until it reports back via NOTIFY (or the timeout fires).
 * The listener is registered before sending so a fast librarian can't NOTIFY too early.
 */
const enqueueAndWait = async <T extends object>(
  queue: string,
  data: T,
  timeoutMs?: number,
): Promise<NotifyResult> => {
  const requestId = crypto.randomUUID();
  const notified = waitForNotify(requestId, timeoutMs);

  const boss = await getBoss();
  await boss.send(queue, { ...data, requestId }, JOB_OPTIONS);

  return notified;
};

/**
 * Make sure the given IGDB ids exist in the local catalog, fetching missing ones
 * through the librarian. Returns the subset of ids that are present afterwards.
 */
export const ensureGamesInCatalog = async (
  ids: number[],
  timeoutMs?: number,
): Promise<{ available: Set<number>; fetched: number[] }> => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return { available: new Set(), fetched: [] };

  const findExisting = async (candidates: number[]) =>
    new Set(
      (await db.select({ id: game.id }).from(game).where(inArray(game.id, candidates))).map(
        (row) => row.id,
      ),
    );

  const available = await findExisting(uniqueIds);
  const missing = uniqueIds.filter((id) => !available.has(id));

  if (missing.length === 0) return { available, fetched: [] };

  await enqueueAndWait<Omit<FetchByIdsJob, "requestId">>(
    QUEUES.FETCH_BY_IDS,
    { ids: missing },
    timeoutMs,
  );

  const fetched = [...(await findExisting(missing))];
  for (const id of fetched) available.add(id);

  return { available, fetched };
};
