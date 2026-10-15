import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import { statusSchema } from "@/modules/userGame/model";
import { isFlagSet, LibrarySort } from "@/utils/enums";

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
      status: t.Optional(statusSchema),
      q: t.Optional(t.String({ maxLength: 100 })),
      sort: t.Optional(t.Enum(LibrarySort)),
      // 1/true for graded entries only, 0/false for the ungraded (the grading deck)
      graded: t.Optional(t.String({ maxLength: 5 })),
    }),
  },
  ({ params, query, viewer }) =>
    UserGameService.getUserGames(params.username, {
      ...query,
      graded: query.graded === undefined ? undefined : isFlagSet(query.graded),
      viewerId: viewer?.id ?? null,
    }),
);
