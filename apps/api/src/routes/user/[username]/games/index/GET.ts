import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import { isFlagSet } from "@/utils/enums";

export const getUserGamesIndex = new Elysia().use(betterAuth).get(
  "/user/:username/games/index",
  {
    viewer: true,
    params: t.Object({ username: t.String() }),
    // 1/true for graded entries only, 0/false for the ungraded (the grading deck)
    query: t.Object({ graded: t.Optional(t.String({ maxLength: 5 })) }),
  },
  ({ params, query, viewer }) =>
    UserGameService.getLibraryIndex(params.username, viewer?.id ?? null, {
      graded: query.graded === undefined ? undefined : isFlagSet(query.graded),
    }),
);
