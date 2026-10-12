import type { PgBoss } from "pg-boss";
import { QUEUES } from "@playdamnit/db/jobs";

import { getConfig } from "@/config";
import { SteamService } from "@/modules/steam/service";
import { createLogger } from "@/utils/enhancedLogger";
import { LogNamespace, Schedule } from "@/utils/enums";

const logger = createLogger(LogNamespace.SteamSync);

/** Linked Steam libraries sync on their own every few hours; off without a Steam key */
export const registerSteamSync = async (boss: PgBoss): Promise<void> => {
  if (!getConfig().steamApiKey) {
    logger.system("Steam sync off: no STEAM_API_KEY");
    return;
  }
  await boss.work(QUEUES.STEAM_SYNC, () => SteamService.syncLinked((m) => logger.info(m)));
  await boss.schedule(QUEUES.STEAM_SYNC, Schedule.SteamSync);
  logger.system(`Steam sync scheduled (${Schedule.SteamSync})`);
};
