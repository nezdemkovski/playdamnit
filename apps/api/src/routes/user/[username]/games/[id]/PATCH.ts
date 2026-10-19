import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import {
  endedAtSchema,
  gradeSchema,
  libraryGameParams,
  platformIdSchema,
  ratingSchema,
  reviewSchema,
  statusSchema,
} from "@/modules/userGame/model";

export const patchUserGame = new Elysia().use(betterAuth).patch(
  "/user/:username/games/:id",
  {
    auth: true,
    params: libraryGameParams,
    body: t.Object({
      timeZone: t.Optional(t.String({ maxLength: 100 })),
      status: t.Optional(statusSchema),
      rating: t.Optional(t.Nullable(ratingSchema)),
      grade: t.Optional(t.Nullable(gradeSchema)),
      review: t.Optional(t.Nullable(reviewSchema)),
      platformId: t.Optional(t.Nullable(platformIdSchema)),
      endedAt: t.Optional(t.Nullable(endedAtSchema)),
      mastered: t.Optional(t.Boolean()),
      spoilers: t.Optional(t.Boolean()),
      allowReactions: t.Optional(t.Boolean()),
    }),
  },
  ({ params, user, body }) => {
    UserGameService.assertOwnLibrary(params.username, user);
    return UserGameService.updateUserGame(user.id, params.id, body);
  },
);
