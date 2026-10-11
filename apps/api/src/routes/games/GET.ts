import { Elysia, t } from "elysia";
import { GameService, MAX_GAMES_PAGE_SIZE } from "@/modules/game/service";
import { GameSort } from "@/utils/enums";

const idList = (value: string | undefined) =>
  value
    ? value
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0)
    : undefined;

export const getGames = new Elysia().get(
  "/games",
  {
    query: t.Object({
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_GAMES_PAGE_SIZE, default: 100 })),
      offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
      platformId: t.Optional(t.Numeric()),
      genreId: t.Optional(t.Numeric()),
      year: t.Optional(t.Numeric({ minimum: 1950, maximum: 2100 })),
      releasedFrom: t.Optional(t.Numeric({ minimum: 0 })),
      releasedTo: t.Optional(t.Numeric({ minimum: 0 })),
      types: t.Optional(t.String({ maxLength: 100 })),
      ids: t.Optional(t.String({ maxLength: 1000 })),
      sort: t.Optional(t.Enum(GameSort)),
    }),
  },
  ({ query }) =>
    GameService.findGames({
      ...query,
      types: idList(query.types),
      ids: idList(query.ids)?.slice(0, MAX_GAMES_PAGE_SIZE),
    }),
);
