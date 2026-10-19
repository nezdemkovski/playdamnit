import { t } from "elysia";

import { UserGameStatus } from "@playdamnit/db/enums";
import { Grade } from "@/utils/enums";

export const MAX_REVIEW_LENGTH = 5000;

// Statuses that describe a finished run, the only ones where endedAt makes sense
export const ENDED_STATUSES: readonly string[] = [UserGameStatus.Finished, UserGameStatus.Dropped];

// Not t.UnionEnum: inside t.Optional, Elysia fills a missing UnionEnum with its first value,
// which turned a PATCH without `status` into status "finished". t.Enum keeps it missing.
export const statusSchema = t.Enum(UserGameStatus, {
  error: `Status must be one of: ${Object.values(UserGameStatus).join(", ")}`,
});

export const ratingSchema = t.Number({
  minimum: 0,
  maximum: 10,
  error: "Rating must be between 0 and 10",
});

export const gradeSchema = t.Enum(Grade, {
  error: `Grade must be one of: ${Object.values(Grade).join(", ")}`,
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

export const playthroughInputSchema = t.Object({
  startedAt: t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
  endedAt: t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
  hours: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 99999 }))),
  platformId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
  note: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
});
