import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { REVIEW_SORTS, ReviewService } from "@/modules/review/service";
import { REACTION_EMOJIS } from "@playdamnit/db/schema";

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
  .put(
    "/reviews/:id/reaction",
    {
      auth: true,
      params: reviewParams,
      body: t.Object({ emoji: t.Union(REACTION_EMOJIS.map((e) => t.Literal(e))) }),
    },
    ({ params, user, body }) => ReviewService.react(user.id, params.id, body.emoji),
  )
  .delete("/reviews/:id/reaction", { auth: true, params: reviewParams }, ({ params, user }) =>
    ReviewService.unreact(user.id, params.id),
  );
