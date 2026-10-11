import { Elysia, status, t } from "elysia";

import { getConfig } from "@/config";
import {
  markDirty,
  parseWebhookPayload,
  secretMatches,
  WEBHOOK_ENTITIES,
  WEBHOOK_METHODS,
} from "@/modules/webhook/service";
import { createLogger } from "@/utils/enhancedLogger";

const logger = createLogger("igdb-webhook");

/**
 * IGDB webhook receiver. The librarian registers these URLs with IGDB; IGDB posts the changed
 * entity (or just its id on delete) with our secret in `X-Secret`. The handler only resolves the
 * game id and queues it in `catalog_dirty`; the librarian's `drain-dirty` job does the fetching.
 * No auth macro, no rate limiter: the secret is the credential.
 */
export const postIgdbWebhook = new Elysia().post(
  "/webhooks/igdb/:entity/:method",
  {
    params: t.Object({
      entity: t.Union(WEBHOOK_ENTITIES.map((entity) => t.Literal(entity))),
      method: t.Union(WEBHOOK_METHODS.map((method) => t.Literal(method))),
    }),
  },
  async ({ params, body, request }) => {
    const { igdbWebhookSecret } = getConfig();
    if (!igdbWebhookSecret) {
      return status(404, { error: "Not Found", message: "IGDB webhooks are not configured" });
    }
    if (!secretMatches(request.headers.get("x-secret"), igdbWebhookSecret)) {
      return status(403, { error: "Forbidden", message: "Bad webhook secret" });
    }

    const payload = parseWebhookPayload(body);
    if (!payload) {
      return status(400, { error: "Bad Request", message: "Webhook body is not a JSON object" });
    }

    const gameId = await markDirty(params.entity, params.method, payload);
    if (!gameId) {
      logger.info(`Ignored ${params.entity}/${params.method} webhook: no game to resolve`, {
        id: payload.id,
      });
    }

    return { ok: true, gameId };
  },
);
