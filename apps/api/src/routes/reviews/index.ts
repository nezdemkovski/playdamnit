import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { REVIEW_SORTS, ReviewService } from "@/modules/review/service";

const reviewParams = t.Object({ id: t.String({ format: "uuid" }) });

export const reviewRoutes = new Elysia()
  .use(betterAuth)
  // Site-wide feed of reviews (home page); `following=1` keeps the people the viewer follows
  .get(
    "/reviews",
    {
      viewer: true,
      query: t.Object({
        sort: t.Optional(t.Union(REVIEW_SORTS.map((s) => t.Literal(s)))),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, default: 20 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
        following: t.Optional(t.String()),
      }),
    },
    ({ query, viewer }) =>
      ReviewService.list({
        viewerId: viewer?.id ?? null,
        followedBy: query.following && viewer ? viewer.id : undefined,
        sort: query.sort,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
        withGame: true,
      }),
  )
  .post("/reviews/:id/like", { auth: true, params: reviewParams }, ({ params, user }) =>
    ReviewService.like(user.id, params.id),
  )
  .delete("/reviews/:id/like", { auth: true, params: reviewParams }, ({ params, user }) =>
    ReviewService.unlike(user.id, params.id),
  );
