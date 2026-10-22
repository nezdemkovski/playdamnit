import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { MAX_LIST_DESCRIPTION_LENGTH, MAX_LIST_NAME_LENGTH } from "@/utils/limits";
import { ListService, MAX_LIST_GAMES } from "@/modules/list/service";
import { StringFormat } from "@/utils/enums";

const params = t.Object({ id: t.String({ format: StringFormat.Uuid }) });

export const listRoutes = new Elysia()
  .use(betterAuth)
  .get("/lists/:id", { viewer: true, params }, ({ params, viewer }) =>
    ListService.get(params.id, viewer?.id ?? null),
  )
  .patch(
    "/lists/:id",
    {
      auth: true,
      params,
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: MAX_LIST_NAME_LENGTH })),
        description: t.Optional(t.Nullable(t.String({ maxLength: MAX_LIST_DESCRIPTION_LENGTH }))),
        isPublic: t.Optional(t.Boolean()),
      }),
    },
    ({ params, user, body }) => ListService.update(params.id, user.id, body),
  )
  .delete("/lists/:id", { auth: true, params }, ({ params, user }) =>
    ListService.remove(params.id, user.id),
  )
  .put(
    "/lists/:id/games",
    {
      auth: true,
      params,
      body: t.Object({ gameIds: t.Array(t.Integer({ minimum: 1 }), { maxItems: MAX_LIST_GAMES }) }),
    },
    ({ params, user, body }) => ListService.setGames(params.id, user.id, body.gameIds),
  )
  .post(
    "/lists/:id/games",
    { auth: true, params, body: t.Object({ gameId: t.Integer({ minimum: 1 }) }) },
    ({ params, user, body }) => ListService.addGame(params.id, user.id, body.gameId),
  )
  .delete(
    "/lists/:id/games/:gameId",
    {
      auth: true,
      params: t.Object({ id: t.String({ format: StringFormat.Uuid }), gameId: t.Numeric() }),
    },
    ({ params, user }) => ListService.removeGame(params.id, user.id, params.gameId),
  );
