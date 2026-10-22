import type { userGames } from "@playdamnit/db/schema";
import { gradeOf } from "@/utils/grade";
import { idleOf } from "./idle";

/** A member's entry in full, review included: the `userGameData` every full entry carries */
export const toUserGameData = (entry: typeof userGames.$inferSelect) => ({
  id: entry.id,
  status: entry.status,
  rating: entry.rating !== null ? Number(entry.rating) : null,
  grade: gradeOf(entry.rating),
  review: entry.review,
  platformId: entry.platformId,
  addedAt: entry.addedAt,
  endedAt: entry.endedAt,
  source: entry.source,
  mastered: entry.mastered,
  spoilers: entry.spoilers,
  allowReactions: entry.allowReactions,
  steamMinutes: entry.steamMinutes,
  steamLastPlayedAt: entry.steamLastPlayedAt,
  updatedAt: entry.updatedAt,
  idle: idleOf(entry),
});
