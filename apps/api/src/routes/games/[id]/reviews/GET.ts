import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { ReviewService } from "@/modules/review/service";
import { ReviewSort } from "@/utils/enums";

export const getGameReviews = new Elysia().use(betterAuth).get(
  "/games/:id/reviews",
  {
    viewer: true,
    params: t.Object({ id: t.Numeric() }),
    query: t.Object({
      sort: t.Optional(t.Enum(ReviewSort)),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, default: 20 })),
      offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
    }),
  },
  ({ params, query, viewer }) =>
    ReviewService.list({
      gameId: params.id,
      viewerId: viewer?.id ?? null,
      sort: query.sort,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    }),
);
