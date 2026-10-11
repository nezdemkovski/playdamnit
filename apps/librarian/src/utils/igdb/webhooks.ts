import { igdbFetch } from "./utils";
import { createLogger } from "../enhancedLogger";

const logger = createLogger("igdb-webhooks");

// Entities whose changes re-fetch a game: the game itself and every child row we store, since
// a new cover, screenshot or store link doesn't bump the game's updated_at. The API receiver
// resolves each of them to a game id (see apps/api/src/modules/webhook/service.ts).
const WEBHOOK_ENTITIES = [
  "games",
  "covers",
  "screenshots",
  "videos",
  "websites",
  "external_games",
  "game_localizations",
  "involved_companies",
] as const;
const WEBHOOK_METHODS = ["create", "update", "delete"] as const;

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
  (await igdbFetch("GET", "webhooks")).json() as Promise<IGDBWebhook[]>;

/**
 * Make sure IGDB has an active webhook for every entity × method we rely on, pointing at this
 * deployment's public API. Inactive ones (IGDB disables a webhook whose URL stopped answering)
 * are deleted and re-created. Safe to run on every start.
 */
export const ensureWebhooks = async (opts: { baseUrl: string; secret: string }) => {
  const existing = await listWebhooks();
  const byUrl = new Map(existing.map((hook) => [hook.url, hook]));
  const result = { existing: existing.length, created: 0, recreated: 0, active: 0 };

  for (const entity of WEBHOOK_ENTITIES) {
    for (const method of WEBHOOK_METHODS) {
      const url = webhookUrl(opts.baseUrl, entity, method);
      const hook = byUrl.get(url);

      if (hook?.active) {
        result.active++;
        continue;
      }
      if (hook) {
        await igdbFetch("DELETE", `webhooks/${hook.id}`);
        result.recreated++;
      } else {
        result.created++;
      }
      await igdbFetch(
        "POST",
        `${entity}/webhooks/`,
        new URLSearchParams({ url, method, secret: opts.secret }),
      );
    }
  }

  logger.info("IGDB webhooks ensured", result);
  return result;
};
