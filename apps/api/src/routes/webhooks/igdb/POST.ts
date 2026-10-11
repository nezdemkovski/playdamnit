import { Elysia, status, t } from "elysia";

import { getConfig } from "@/config";
import { markDirty, parseWebhookPayload, secretMatches } from "@/modules/webhook/service";
import { WebhookEntity, WebhookMethod } from "@playdamnit/db/enums";
import { HttpHeader, LogNamespace } from "@/utils/enums";
import { createLogger } from "@/utils/enhancedLogger";

const logger = createLogger(LogNamespace.IgdbWebhook);

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
      entity: t.Enum(WebhookEntity),
      method: t.Enum(WebhookMethod),
    }),
  },
  async ({ params, body, request }) => {
    const { igdbWebhookSecret } = getConfig();
    if (!igdbWebhookSecret) {
      return status(404, { error: "Not Found", message: "IGDB webhooks are not configured" });
    }
    if (!secretMatches(request.headers.get(HttpHeader.Secret), igdbWebhookSecret)) {
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
