import { PgBoss } from "pg-boss";

import { ALL_QUEUES } from "@playdamnit/db/jobs";
import logger, { flushSentry, initSentry } from "./utils/enhancedLogger";
import { registerIgdbWorkers } from "./workers/igdbWorker";
import { registerRefreshWorker } from "./workers/refreshWorker";
import { registerLookupsWorker } from "./workers/lookupsWorker";
import { registerCatalogSyncWorker } from "./workers/catalogSyncWorker";
import { registerDrainWorker } from "./workers/drainWorker";
import { registerWebhookWorker } from "./workers/webhookWorker";
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
  await registerWebhookWorker(boss);

  logger.system("All workers registered. Librarian is running.");
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
