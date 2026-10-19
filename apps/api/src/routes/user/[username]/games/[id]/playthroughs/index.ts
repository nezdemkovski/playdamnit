import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import { libraryGameParams, playthroughInputSchema } from "@/modules/userGame/model";
import { StringFormat } from "@/utils/enums";

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
    { auth: true, params: libraryGameParams, body: playthroughInputSchema },
    ({ params, user, body }) => {
      UserGameService.assertOwnLibrary(params.username, user);
      return UserGameService.addPlaythrough(user.id, params.id, body);
    },
  )
  .put(
    "/user/:username/games/:id/playthroughs",
    {
      auth: true,
      params: libraryGameParams,
      body: t.Object({
        runs: t.Array(
          t.Intersect([
            playthroughInputSchema,
            t.Object({ id: t.String({ format: StringFormat.Uuid }) }),
          ]),
          { minItems: 1, maxItems: 100 },
        ),
      }),
    },
    ({ params, user, body }) => {
      UserGameService.assertOwnLibrary(params.username, user);
      return UserGameService.addPlaythroughs(user.id, params.id, body.runs);
    },
  )
  .patch(
    "/user/:username/games/:id/playthroughs/:playthroughId",
    { auth: true, params: withPlaythrough, body: playthroughInputSchema },
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
