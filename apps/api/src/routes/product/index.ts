import { Elysia, t } from "elysia";

import { getConfig } from "@/config";
import { betterAuth } from "@/lib/betterAuth";
import { getChangelog } from "@/modules/product/changelog";
import { createFeedbackService } from "@/modules/product/feedback";
import { feedbackSchema, ProductPlatform } from "@/modules/product/model";
import { createRateLimiter } from "@/utils/rateLimit";

const limit = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
const config = getConfig();
const feedback = createFeedbackService({
  apiKey: config.linearApiKey,
  teamId: config.linearTeamId,
  projectId: config.linearProjectId,
});

export const productRoutes = new Elysia()
  .use(betterAuth)
  .get(
    "/changelog",
    {
      query: t.Object({
        locale: t.Optional(t.String({ maxLength: 35 })),
        platform: t.Optional(t.Enum(ProductPlatform)),
      }),
    },
    ({ query }) => getChangelog(query.locale, query.platform),
  )
  .post("/feedback", { auth: true, body: feedbackSchema }, async ({ user, body, set }) => {
    limit.check(user.id);
    const result = await feedback.submit(user, body);
    set.status = 201;
    return result;
  });
