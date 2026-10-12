import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { MAX_RECOMMENDATIONS, RecommendationService } from "@/modules/recommendation/service";

export const recommendationRoutes = new Elysia().use(betterAuth).get(
  "/me/recommendations",
  {
    auth: true,
    query: t.Object({
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_RECOMMENDATIONS, default: 20 })),
    }),
  },
  ({ user, query }) => RecommendationService.forUser(user.id, query.limit ?? 20),
);
