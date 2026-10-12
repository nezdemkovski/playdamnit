import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";

export const getUserGamesIndex = new Elysia()
  .use(betterAuth)
  .get(
    "/user/:username/games/index",
    { viewer: true, params: t.Object({ username: t.String() }) },
    ({ params, viewer }) => UserGameService.getLibraryIndex(params.username, viewer?.id ?? null),
  );
