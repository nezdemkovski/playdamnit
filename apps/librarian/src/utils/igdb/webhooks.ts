import { WebhookEntity, WebhookMethod } from "@playdamnit/db/enums";
import { HttpMethod, LogNamespace } from "../enums";
import { igdbFetch } from "./utils";
import { createLogger } from "../enhancedLogger";

const logger = createLogger(LogNamespace.IgdbWebhooks);

// Every entity whose change re-fetches a game: the game itself and every child row we store,
// since a new cover, screenshot or store link doesn't bump the game's updated_at. The API
// receiver resolves each of them to a game id (see apps/api/src/modules/webhook/service.ts).
// Where the receiver path and IGDB's endpoint name differ:
const IGDB_ENDPOINT: Partial<Record<WebhookEntity, string>> = {
  [WebhookEntity.Videos]: "game_videos",
};

interface IGDBWebhook {
  id: number;
  url: string;
  category: number;
  sub_category: number;
  active: boolean;
  secret?: string;
}

const webhookUrl = (baseUrl: string, entity: string, method: string) =>
  `${baseUrl.replace(/\/+$/, "")}/api/webhooks/igdb/${entity}/${method}`;

const listWebhooks = async (): Promise<IGDBWebhook[]> =>
  (await igdbFetch(HttpMethod.Get, "webhooks")).json() as Promise<IGDBWebhook[]>;

/**
 * Make sure IGDB has an active webhook for every entity × method we rely on, pointing at this
 * deployment's public API. Inactive ones (IGDB disables a webhook whose URL stopped answering)
 * are deleted and re-created. Safe to run on every start.
 */
export const ensureWebhooks = async (opts: { baseUrl: string; secret: string }) => {
  const existing = await listWebhooks();
  const byUrl = new Map(existing.map((hook) => [hook.url, hook]));
  const result = { existing: existing.length, created: 0, recreated: 0, active: 0, failed: 0 };

  for (const entity of Object.values(WebhookEntity)) {
    for (const method of Object.values(WebhookMethod)) {
      const url = webhookUrl(opts.baseUrl, entity, method);
      const hook = byUrl.get(url);

      if (hook?.active) {
        result.active++;
        continue;
      }
      // One bad hook must not stop the others from being registered
      try {
        if (hook) {
          await igdbFetch(HttpMethod.Delete, `webhooks/${hook.id}`);
        }
        await igdbFetch(
          HttpMethod.Post,
          `${IGDB_ENDPOINT[entity] ?? entity}/webhooks/`,
          new URLSearchParams({ url, method, secret: opts.secret }),
        );
        if (hook) result.recreated++;
        else result.created++;
      } catch (error) {
        result.failed++;
        logger.exception(error, { operation: "ensureWebhooks", entity, method });
      }
    }
  }

  logger.info("IGDB webhooks ensured", result);
  return result;
};
