import type { PgBoss } from "pg-boss";

import { QUEUES } from "@playdamnit/db/jobs";
import { ensureWebhooks } from "../utils/igdb/webhooks";
import { createLogger } from "../utils/enhancedLogger";
import { LogNamespace, Schedule } from "../utils/enums";

const logger = createLogger(LogNamespace.IgdbWebhooks);

/** IGDB disables a subscription after five failed deliveries, even for a brief tunnel outage. */
export const registerWebhookWorker = async (boss: PgBoss): Promise<void> => {
  const baseUrl = process.env.WEBHOOK_BASE_URL;
  const secret = process.env.IGDB_WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    logger.info("WEBHOOK_BASE_URL / IGDB_WEBHOOK_SECRET not set: webhook maintenance disabled");
    // A persisted production schedule can outlive the configuration that enabled it.
    await boss.unschedule(QUEUES.ENSURE_WEBHOOKS);
    return;
  }

  await boss.work(QUEUES.ENSURE_WEBHOOKS, async () => {
    try {
      const result = await ensureWebhooks({ baseUrl, secret });
      // ensureWebhooks attempts every subscription; a partial failure must still fail the job.
      if (result.failed > 0) {
        throw new Error(`Failed to restore ${result.failed} IGDB webhook subscriptions`);
      }
    } catch (error) {
      logger.exception(error, { operation: QUEUES.ENSURE_WEBHOOKS });
      throw error;
    }
  });
  await boss.schedule(QUEUES.ENSURE_WEBHOOKS, Schedule.EnsureWebhooks);
  // Use the same handler on startup without holding up the other workers on an IGDB outage.
  await boss.send(
    QUEUES.ENSURE_WEBHOOKS,
    {},
    { singletonKey: "startup", singletonSeconds: 300, expireInSeconds: 300 },
  );
};
