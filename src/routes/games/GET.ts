import { Elysia, t } from "elysia";
import { GameService, MAX_GAMES_PAGE_SIZE } from "@/modules/game/service";

export const getGames = new Elysia().get(
  "/games",
  ({ query }) => GameService.findGames(query),
  {
    query: t.Object({
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_GAMES_PAGE_SIZE, default: 100 })),
      offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
      platformId: t.Optional(t.Numeric()),
    }),
  }
);
