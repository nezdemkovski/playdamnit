import { PgBoss } from "pg-boss";

import { ALL_QUEUES } from "@playdamnit/db/jobs";
import logger from "./utils/enhancedLogger";
import { registerIgdbWorkers } from "./workers/igdbWorker";
import { registerSimilarGamesWorker } from "./workers/similarGamesWorker";
import { registerRefreshWorker } from "./workers/refreshWorker";

const validateEnvironment = () => {
  const missingVars: string[] = [];

  if (!process.env.POSTGRES_URL) missingVars.push("POSTGRES_URL");
  if (!process.env.TWITCH_CLIENT_ID) missingVars.push("TWITCH_CLIENT_ID");
  if (!process.env.TWITCH_CLIENT_SECRET) missingVars.push("TWITCH_CLIENT_SECRET");

  if (missingVars.length > 0) {
    logger.error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
    process.exit(1);
  }
};

let boss: PgBoss | null = null;

const start = async () => {
  logger.system("Starting playdamnit librarian service...");

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
  await registerSimilarGamesWorker(boss);
  await registerRefreshWorker(boss);

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
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error) => {
  logger.exception(error, { source: "librarian-start" });
  process.exit(1);
});
