// Operator helper: put a job on a librarian queue from the command line.
//   bun run scripts/enqueue.ts sync-catalog full
//   bun run scripts/enqueue.ts sync-catalog incremental
//   bun run scripts/enqueue.ts sync-lookups
//   bun run scripts/enqueue.ts fetch-by-ids 1942,7346
//   bun run scripts/enqueue.ts drain-dirty
import { PgBoss } from "pg-boss";

import { QUEUES } from "@playdamnit/db/jobs";

const [queue, arg] = process.argv.slice(2);
const data: Record<string, unknown> | null = (() => {
  switch (queue) {
    case QUEUES.SYNC_CATALOG:
      return arg === "full" || arg === "incremental" ? { mode: arg } : null;
    case QUEUES.SYNC_LOOKUPS:
      return { force: true };
    case QUEUES.FETCH_BY_IDS:
      return arg ? { ids: arg.split(",").map(Number) } : null;
    case QUEUES.REFRESH_STALE_GAMES:
    case QUEUES.DRAIN_DIRTY:
      return {};
    default:
      return null;
  }
})();

if (!data) {
  console.error(
    "usage: enqueue.ts <sync-catalog full|incremental | sync-lookups | fetch-by-ids <ids> | refresh-stale-games | drain-dirty>",
  );
  process.exit(1);
}

const boss = new PgBoss(process.env.POSTGRES_URL!);
await boss.start();
const id = await boss.send(queue, data, {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 1800,
});
console.log(id ? `enqueued ${queue} ${id}` : `${queue}: not enqueued (singleton active)`);
await boss.stop({ graceful: false });
