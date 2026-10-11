import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { GameService } from "@/modules/game/service";

export const getGameById = new Elysia().use(betterAuth).get(
  "/games/:id",
  {
    viewer: true,
    params: t.Object({
      id: t.Numeric(),
    }),
  },
  ({ params, viewer }) => GameService.findById(params.id, viewer?.id ?? null),
);
