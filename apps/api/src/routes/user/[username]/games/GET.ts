import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";

export const getUserGames = new Elysia().use(betterAuth).get(
  "/user/:username/games",
  {
    viewer: true,
    params: t.Object({
      username: t.String(),
    }),
    query: t.Object({
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 1000 })),
      offset: t.Optional(t.Numeric({ minimum: 0 })),
    }),
  },
  ({ params, query, viewer }) =>
    UserGameService.getUserGames(params.username, { ...query, viewerId: viewer?.id ?? null }),
);
