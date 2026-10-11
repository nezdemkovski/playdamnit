import { Elysia, t } from "elysia";

import { GameService } from "@/modules/game/service";
import { isFlagSet } from "@/utils/enums";

import { idList } from "../GET";

/** Releases per UTC day in a range: the release calendar's counts */
export const getGameReleaseDays = new Elysia().get(
  "/games/release-days",
  {
    query: t.Object({
      releasedFrom: t.Numeric({ minimum: 0 }),
      releasedTo: t.Numeric({ minimum: 0 }),
      types: t.Optional(t.String({ maxLength: 100 })),
      popular: t.Optional(t.String({ maxLength: 5 })),
    }),
  },
  ({ query }) =>
    GameService.releaseDays({
      releasedFrom: query.releasedFrom,
      releasedTo: query.releasedTo,
      types: idList(query.types),
      popular: isFlagSet(query.popular),
    }),
);
