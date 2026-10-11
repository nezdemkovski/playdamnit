import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { GameService } from "@/modules/game/service";
import { ListService } from "@/modules/list/service";
import { ReviewService } from "@/modules/review/service";
import { UserService } from "@/modules/user/service";
import { canSeeList, requireUser } from "@/utils/social";
import { ForbiddenError } from "@/utils/errors";

const params = t.Object({ username: t.String() });
const page = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 40 })),
  offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
});

/** Follow graph, reviews, journal, likes, lists and the avatar of one user */
export const userSocialRoutes = new Elysia()
  .use(betterAuth)
  .post("/user/:username/follow", { auth: true, params }, ({ params, user }) =>
    UserService.follow(user.id, params.username),
  )
  .delete("/user/:username/follow", { auth: true, params }, ({ params, user }) =>
    UserService.unfollow(user.id, params.username),
  )
  .get(
    "/user/:username/followers",
    { viewer: true, params, query: page },
    ({ params, query, viewer }) =>
      UserService.connections(params.username, "followers", {
        limit: query.limit ?? 40,
        offset: query.offset ?? 0,
        viewerId: viewer?.id ?? null,
      }),
  )
  .get(
    "/user/:username/following",
    { viewer: true, params, query: page },
    ({ params, query, viewer }) =>
      UserService.connections(params.username, "following", {
        limit: query.limit ?? 40,
        offset: query.offset ?? 0,
        viewerId: viewer?.id ?? null,
      }),
  )
  .get(
    "/user/:username/reviews",
    { viewer: true, params, query: page },
    async ({ params, query, viewer }) => {
      const owner = await requireUser(params.username);
      const viewerId = viewer?.id ?? null;
      if (!canSeeList(owner, viewerId)) throw new ForbiddenError("This list is private");
      return ReviewService.list({
        userId: owner.id,
        viewerId,
        limit: query.limit ?? 40,
        offset: query.offset ?? 0,
        withGame: true,
      });
    },
  )
  .get(
    "/user/:username/journal",
    {
      viewer: true,
      params,
      query: t.Object({ year: t.Optional(t.Numeric({ minimum: 1970, maximum: 2100 })) }),
    },
    ({ params, query, viewer }) =>
      UserService.journal(params.username, viewer?.id ?? null, { year: query.year }),
  )
  .get(
    "/user/:username/likes",
    { viewer: true, params, query: page },
    async ({ params, query, viewer }) => {
      const owner = await requireUser(params.username);
      if (!canSeeList(owner, viewer?.id ?? null)) throw new ForbiddenError("This list is private");
      return GameService.likedBy(owner.id, { limit: query.limit ?? 40, offset: query.offset ?? 0 });
    },
  )
  .get("/user/:username/lists", { viewer: true, params }, async ({ params, viewer }) => {
    const owner = await requireUser(params.username);
    return ListService.forUser(owner.id, viewer?.id ?? null);
  })
  .post(
    "/user/:username/lists",
    {
      auth: true,
      params,
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
        isPublic: t.Optional(t.Boolean()),
      }),
    },
    ({ params, user, body }) => {
      if (params.username !== user.username)
        throw new ForbiddenError("You can only create your own lists");
      return ListService.create(user.id, body);
    },
  )
  .get("/user/:username/avatar", { params }, async ({ params, set }) => {
    const avatar = await UserService.avatar(params.username);
    set.headers["content-type"] = avatar.contentType;
    set.headers["cache-control"] = "public, max-age=31536000, immutable";
    return new Response(avatar.data, { headers: { "content-type": avatar.contentType } });
  });
