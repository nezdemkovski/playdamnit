import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import {
  endedAtSchema,
  libraryGameParams,
  platformIdSchema,
  ratingSchema,
  reviewSchema,
  statusSchema,
} from "@/modules/userGame/model";

export const patchUserGame = new Elysia().use(betterAuth).patch(
  "/user/:username/games/:id",
  ({ params, user, body }) => {
    UserGameService.assertOwnLibrary(params.username, user);
    return UserGameService.updateUserGame(user.id, params.id, body);
  },
  {
    auth: true,
    params: libraryGameParams,
    body: t.Object({
      status: t.Optional(statusSchema),
      rating: t.Optional(t.Nullable(ratingSchema)),
      review: t.Optional(t.Nullable(reviewSchema)),
      platformId: t.Optional(t.Nullable(platformIdSchema)),
      endedAt: t.Optional(t.Nullable(endedAtSchema)),
    }),
  }
);
