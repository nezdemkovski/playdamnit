import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { statusSchema } from "@/modules/userGame/model";
import { UserGameService } from "@/modules/userGame/service";

/** A member's tier board, grouped and ordered by the API */
export const getUserGamesTiers = new Elysia().use(betterAuth).get(
  "/user/:username/games/tiers",
  {
    viewer: true,
    params: t.Object({ username: t.String() }),
    query: t.Object({
      status: t.Optional(statusSchema),
      q: t.Optional(t.String({ maxLength: 100 })),
    }),
  },
  ({ params, query, viewer }) =>
    UserGameService.getTiers(params.username, viewer?.id ?? null, query),
);
