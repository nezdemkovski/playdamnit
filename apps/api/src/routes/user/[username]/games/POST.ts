import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import {
  endedAtSchema,
  libraryParams,
  platformIdSchema,
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
      status: statusSchema,
      rating: ratingSchema,
      review: t.Optional(reviewSchema),
      platformId: platformIdSchema,
      endedAt: t.Optional(endedAtSchema),
    }),
  },
  ({ params, user, body }) => {
    UserGameService.assertOwnLibrary(params.username, user);
    const { gameId, ...input } = body;
    return UserGameService.addUserGame(user.id, gameId, input);
  },
);
