import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { MAX_LIST_DESCRIPTION_LENGTH, MAX_LIST_NAME_LENGTH } from "@/utils/limits";
import { GameService } from "@/modules/game/service";
import { ListService } from "@/modules/list/service";
import { ReviewService } from "@/modules/review/service";
import { UserService } from "@/modules/user/service";
import { canSeeList, requireUser } from "@/utils/social";
import { ForbiddenError } from "@/utils/errors";
import { CacheControl, ConnectionKind, HttpHeader } from "@/utils/enums";

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
      UserService.connections(params.username, ConnectionKind.Followers, {
        limit: query.limit ?? 40,
        offset: query.offset ?? 0,
        viewerId: viewer?.id ?? null,
      }),
  )
  .get(
    "/user/:username/following",
    { viewer: true, params, query: page },
    ({ params, query, viewer }) =>
      UserService.connections(params.username, ConnectionKind.Following, {
        limit: query.limit ?? 40,
        offset: query.offset ?? 0,
        viewerId: viewer?.id ?? null,
      }),
  )
  .get(
    "/user/:username/reviews",
    { viewer: true, params, query: page },
    async ({ params, query, viewer }) => {
      const viewerId = viewer?.id ?? null;
      const owner = await requireUser(params.username, viewer?.id ?? null);
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
      // No `limit` keeps the whole journal in one answer, as before paging
      query: t.Object({
        year: t.Optional(t.Numeric({ minimum: 1970, maximum: 2100 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
      }),
    },
    ({ params, query, viewer }) =>
      UserService.journal(params.username, viewer?.id ?? null, {
        year: query.year,
        limit: query.limit,
        offset: query.offset ?? 0,
      }),
  )
  .get(
    "/user/:username/likes",
    { viewer: true, params, query: page },
    async ({ params, query, viewer }) => {
      const owner = await requireUser(params.username, viewer?.id ?? null);
      if (!canSeeList(owner, viewer?.id ?? null)) throw new ForbiddenError("This list is private");
      return GameService.likedBy(owner.id, { limit: query.limit ?? 40, offset: query.offset ?? 0 });
    },
  )
  .get("/user/:username/lists", { viewer: true, params }, async ({ params, viewer }) => {
    const owner = await requireUser(params.username, viewer?.id ?? null);
    return ListService.forUser(owner.id, viewer?.id ?? null);
  })
  .post(
    "/user/:username/lists",
    {
      auth: true,
      params,
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: MAX_LIST_NAME_LENGTH }),
        description: t.Optional(t.Nullable(t.String({ maxLength: MAX_LIST_DESCRIPTION_LENGTH }))),
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
    set.headers[HttpHeader.ContentType] = avatar.contentType;
    set.headers[HttpHeader.CacheControl] = CacheControl.Immutable;
    return new Response(avatar.data, { headers: { [HttpHeader.ContentType]: avatar.contentType } });
  });
