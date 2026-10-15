import { PgBoss } from "pg-boss";

import { ALL_QUEUES } from "@playdamnit/db/jobs";
import logger, { flushSentry, initSentry } from "./utils/enhancedLogger";
import { registerIgdbWorkers } from "./workers/igdbWorker";
import { registerRefreshWorker } from "./workers/refreshWorker";
import { registerLookupsWorker } from "./workers/lookupsWorker";
import { registerCatalogSyncWorker } from "./workers/catalogSyncWorker";
import { registerDrainWorker } from "./workers/drainWorker";
import { ensureWebhooks } from "./utils/igdb/webhooks";
import { LogSource } from "./utils/enums";

const validateEnvironment = () => {
  const missingVars: string[] = [];

  if (!process.env.POSTGRES_URL) missingVars.push("POSTGRES_URL");
  if (!process.env.TWITCH_CLIENT_ID) missingVars.push("TWITCH_CLIENT_ID");
  if (!process.env.TWITCH_CLIENT_SECRET) missingVars.push("TWITCH_CLIENT_SECRET");

  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(", ")}`);
    process.exit(1);
  }
};

let boss: PgBoss | null = null;

/**
 * Point IGDB's webhooks at this deployment. Needs the public API URL; without it (local dev)
 * nothing is registered and the daily incremental sync alone keeps the catalog fresh.
 */
const registerIgdbWebhooks = async () => {
  const baseUrl = process.env.WEBHOOK_BASE_URL;
  const secret = process.env.IGDB_WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    logger.system("WEBHOOK_BASE_URL / IGDB_WEBHOOK_SECRET not set: IGDB webhooks not registered");
    return;
  }
  try {
    await ensureWebhooks({ baseUrl, secret });
  } catch (error) {
    // Not fatal: the incremental sync covers the gap until the next start
    logger.exception(error, { operation: "ensureWebhooks" });
  }
};

const start = async () => {
  logger.system("Starting playdamnit librarian service...");
  logger.system(initSentry() ? "Sentry error tracking enabled" : "Sentry error tracking disabled");

  validateEnvironment();

  boss = new PgBoss(process.env.POSTGRES_URL!);

  boss.on("error", (error) => {
    logger.exception(error, { context: "pg-boss", operation: "error-event" });
  });

  await boss.start();
  logger.system("pg-boss started");

  // pg-boss >= 10 refuses send()/work() on queues that were never created
  for (const name of ALL_QUEUES) {
    await boss.createQueue(name);
  }

  await registerIgdbWorkers(boss);
  await registerRefreshWorker(boss);
  await registerLookupsWorker(boss);
  await registerCatalogSyncWorker(boss);
  await registerDrainWorker(boss);

  logger.system("All workers registered. Librarian is running.");

  await registerIgdbWebhooks();
};

const shutdown = async () => {
  logger.system("Librarian shutting down...");

  try {
    if (boss) {
      await boss.stop();
    }
  } catch (error) {
    logger.exception(error, { context: "librarian", operation: "shutdown" });
  }

  logger.system("Librarian shut down successfully");
  await flushSentry();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch(async (error) => {
  logger.exception(error, { source: LogSource.LibrarianStart });
  await flushSentry();
  process.exit(1);
});
