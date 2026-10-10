import { Elysia } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import { libraryGameParams } from "@/modules/userGame/model";

export const deleteUserGame = new Elysia().use(betterAuth).delete(
  "/user/:username/games/:id",
  ({ params, user }) => {
    UserGameService.assertOwnLibrary(params.username, user);
    return UserGameService.deleteUserGame(user.id, params.id);
  },
  {
    auth: true,
    params: libraryGameParams,
  }
);
