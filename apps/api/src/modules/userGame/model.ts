import { t } from "elysia";

import { USER_GAME_STATUSES } from "@playdamnit/db/schema";

export const MAX_REVIEW_LENGTH = 5000;

// Statuses that describe a finished run, the only ones where endedAt makes sense
export const ENDED_STATUSES: readonly string[] = ["finished", "dropped"];

// Not t.UnionEnum: inside t.Optional, Elysia 1.4.30 fills a missing UnionEnum with its
// first value, which turned a PATCH without `status` into status "finished"
export const statusSchema = t.Union(
  USER_GAME_STATUSES.map((status) => t.Literal(status)),
  { error: `Status must be one of: ${USER_GAME_STATUSES.join(", ")}` }
);

export const ratingSchema = t.Number({
  minimum: 0,
  maximum: 10,
  error: "Rating must be between 0 and 10",
});

export const reviewSchema = t.String({
  maxLength: MAX_REVIEW_LENGTH,
  error: `Review must be at most ${MAX_REVIEW_LENGTH} characters`,
});

export const platformIdSchema = t.Numeric({
  error: "Platform ID must be a valid number",
});

// Parsed and checked (valid, not in the future) by UserGameService.parseEndedAt
export const endedAtSchema = t.String({ maxLength: 64 });

export const libraryParams = t.Object({
  username: t.String(),
});

export const libraryGameParams = t.Object({
  username: t.String(),
  id: t.Numeric(),
});
