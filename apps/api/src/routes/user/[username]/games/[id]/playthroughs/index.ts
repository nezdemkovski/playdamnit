import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import { libraryGameParams, playthroughInputSchema } from "@/modules/userGame/model";
import { StringFormat } from "@/utils/enums";

const body = playthroughInputSchema;

const withPlaythrough = t.Object({
  username: t.String(),
  id: t.Numeric(),
  playthroughId: t.String({ format: StringFormat.Uuid }),
});

export const playthroughRoutes = new Elysia()
  .use(betterAuth)
  .get(
    "/user/:username/games/:id/playthroughs",
    { viewer: true, params: libraryGameParams },
    ({ params, viewer }) =>
      UserGameService.listPlaythroughs(params.username, params.id, viewer?.id ?? null),
  )
  .post(
    "/user/:username/games/:id/playthroughs",
    { auth: true, params: libraryGameParams, body },
    ({ params, user, body }) => {
      UserGameService.assertOwnLibrary(params.username, user);
      return UserGameService.addPlaythrough(user.id, params.id, body);
    },
  )
  .patch(
    "/user/:username/games/:id/playthroughs/:playthroughId",
    { auth: true, params: withPlaythrough, body },
    ({ params, user, body }) => {
      UserGameService.assertOwnLibrary(params.username, user);
      return UserGameService.updatePlaythrough(user.id, params.playthroughId, body);
    },
  )
  .delete(
    "/user/:username/games/:id/playthroughs/:playthroughId",
    { auth: true, params: withPlaythrough },
    ({ params, user }) => {
      UserGameService.assertOwnLibrary(params.username, user);
      return UserGameService.deletePlaythrough(user.id, params.playthroughId);
    },
  );
