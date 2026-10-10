import { Elysia, t } from "elysia";
import { UserGameService } from "@/modules/userGame/service";

export const getUserGames = new Elysia().get("/user/:username/games", {
  params: t.Object({
    username: t.String(),
  }),
  query: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 1000 })),
    offset: t.Optional(t.Numeric({ minimum: 0 })),
  }),
}, ({ params, query }) => UserGameService.getUserGames(params.username, query));
