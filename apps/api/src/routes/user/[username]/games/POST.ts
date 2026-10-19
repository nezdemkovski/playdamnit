import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import {
  endedAtSchema,
  gradeSchema,
  libraryParams,
  platformIdSchema,
  playthroughInputSchema,
  ratingSchema,
  reviewSchema,
  statusSchema,
} from "@/modules/userGame/model";

export const postUserGame = new Elysia().use(betterAuth).post(
  "/user/:username/games",
  {
    auth: true,
    params: libraryParams,
    body: t.Object({
      gameId: t.Numeric({
        error: "Game ID must be a valid number",
      }),
      timeZone: t.Optional(t.String({ maxLength: 100 })),
      status: statusSchema,
      rating: t.Optional(ratingSchema),
      grade: t.Optional(t.Nullable(gradeSchema)),
      review: t.Optional(reviewSchema),
      // Left out, the server picks one (UserGameService.defaultPlatform)
      platformId: t.Optional(t.Nullable(platformIdSchema)),
      endedAt: t.Optional(t.Nullable(endedAtSchema)),
      mastered: t.Optional(t.Boolean()),
      spoilers: t.Optional(t.Boolean()),
      allowReactions: t.Optional(t.Boolean()),
      playthroughs: t.Optional(t.Array(playthroughInputSchema, { maxItems: 100 })),
    }),
  },
  ({ params, user, body }) => {
    UserGameService.assertOwnLibrary(params.username, user);
    const { gameId, ...input } = body;
    return UserGameService.addUserGame(user.id, gameId, input);
  },
);
