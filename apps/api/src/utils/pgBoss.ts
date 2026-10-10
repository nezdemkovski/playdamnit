import { PgBoss } from "pg-boss";

import { ALL_QUEUES } from "@playdamnit/db/jobs";
import { createLogger } from "@/utils/enhancedLogger";

const logger = createLogger("pg-boss");

let bossPromise: Promise<PgBoss> | null = null;

const startBoss = async (): Promise<PgBoss> => {
  const boss = new PgBoss(process.env.POSTGRES_URL!);

  boss.on("error", (error) => {
    logger.exception(error, { context: "pg-boss", operation: "error-event" });
  });

  await boss.start();

  // pg-boss >= 10 refuses send()/work() on queues that were never created
  for (const name of ALL_QUEUES) {
    await boss.createQueue(name);
  }

  return boss;
};

export const getBoss = (): Promise<PgBoss> => {
  if (!bossPromise) {
    bossPromise = startBoss().catch((error) => {
      bossPromise = null;
      throw error;
    });
  }
  return bossPromise;
};

export const stopBoss = async (): Promise<void> => {
  if (bossPromise) {
    const boss = await bossPromise;
    bossPromise = null;
    await boss.stop();
  }
};
