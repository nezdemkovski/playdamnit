import { Elysia, t } from "elysia";

import { sessionUserId, UNAUTHORIZED } from "@/lib/betterAuth";
import { GameService } from "@/modules/game/service";
import { isFlagSet } from "@/utils/enums";

import { idList } from "../GET";

/** Releases per UTC day in a range: the release calendar's counts; `mine=1` counts the viewer's library */
export const getGameReleaseDays = new Elysia().get(
  "/games/release-days",
  {
    query: t.Object({
      releasedFrom: t.Numeric({ minimum: 0 }),
      releasedTo: t.Numeric({ minimum: 0 }),
      types: t.Optional(t.String({ maxLength: 100 })),
      popular: t.Optional(t.String({ maxLength: 5 })),
      mine: t.Optional(t.String({ maxLength: 5 })),
    }),
  },
  async ({ query, request, status }) => {
    const ownerId = isFlagSet(query.mine) ? await sessionUserId(request.headers) : undefined;
    if (ownerId === null) return status(401, UNAUTHORIZED);
    return GameService.releaseDays({
      releasedFrom: query.releasedFrom,
      releasedTo: query.releasedTo,
      types: idList(query.types),
      popular: isFlagSet(query.popular),
      ownerId,
    });
  },
);
