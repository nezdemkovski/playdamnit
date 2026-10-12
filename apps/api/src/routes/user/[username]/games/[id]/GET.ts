import { Elysia } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import { libraryGameParams } from "@/modules/userGame/model";

export const getUserGame = new Elysia()
  .use(betterAuth)
  .get(
    "/user/:username/games/:id",
    { viewer: true, params: libraryGameParams },
    ({ params, viewer }) =>
      UserGameService.getEntry(params.username, params.id, viewer?.id ?? null),
  );
