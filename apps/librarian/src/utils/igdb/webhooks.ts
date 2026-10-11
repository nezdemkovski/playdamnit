import { igdbFetch } from "./utils";
import { createLogger } from "../enhancedLogger";

const logger = createLogger("igdb-webhooks");

// Entities whose changes should re-fetch a game. Covers are separate because a new cover
// doesn't bump the game's updated_at. Other child entities can be added without code changes
// on the API side (its receiver accepts them already).
const WEBHOOK_ENTITIES = ["games", "covers"] as const;
const WEBHOOK_METHODS = ["create", "update", "delete"] as const;

interface IGDBWebhook {
  id: number;
  url: string;
  category: number;
  sub_category: number;
  active: boolean;
  secret?: string;
}

export const webhookUrl = (baseUrl: string, entity: string, method: string) =>
  `${baseUrl.replace(/\/+$/, "")}/api/webhooks/igdb/${entity}/${method}`;

export const listWebhooks = async (): Promise<IGDBWebhook[]> =>
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
