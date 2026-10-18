import { visibleAuthor, requireVisibleAuthor } from "@/modules/moderation/visibility";
import { and, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/db/postgres";
import { notification, user } from "@playdamnit/db/schema";
import type { NotificationType } from "@playdamnit/db/enums";
import { NotFoundError } from "@/utils/errors";

export const PUBLIC_USER_COLUMNS = { id: true, username: true, name: true, image: true } as const;

export type PublicUser = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
};

/** Resolve a username to the row, or 404. */
export const requireUser = async (username: string, viewerId: string | null = null) => {
  const row = await db.query.user.findFirst({
    where: { username },
    columns: { id: true, username: true, name: true, image: true, listPublic: true },
  });
  if (!row) throw new NotFoundError("User not found");
  await requireVisibleAuthor(row.id, viewerId);
  return row;
};

/** Whether `viewerId` may see `owner`'s list, reviews and journal */
export const canSeeList = (owner: { id: string; listPublic: boolean }, viewerId: string | null) =>
  owner.listPublic || owner.id === viewerId;

/** SQL filter for library rows the viewer may see: public lists plus the viewer's own */
export const visibleToViewer = (userIdColumn: SQL | unknown, viewerId: string | null): SQL =>
  and(
    visibleAuthor(userIdColumn, viewerId),
    viewerId
      ? sql`(exists (select 1 from ${user} where ${user.id} = ${userIdColumn} and ${user.listPublic}) or ${userIdColumn} = ${viewerId})`
      : sql`exists (select 1 from ${user} where ${user.id} = ${userIdColumn} and ${user.listPublic})`,
  )!;

export const isFollowing = async (followerId: string | null, followingId: string) => {
  if (!followerId || followerId === followingId) return false;
  const row = await db.query.userFollows.findFirst({
    where: { followerId, followingId },
    columns: { id: true },
  });
  return !!row;
};

/** Which of these users the viewer follows, in one query instead of one per user */
export const followedAmong = async (followerId: string | null, userIds: string[]) => {
  const ids = userIds.filter((id) => id !== followerId);
  if (!followerId || ids.length === 0) return new Set<string>();
  const rows = await db.query.userFollows.findMany({
    where: { followerId, followingId: { in: ids } },
    columns: { followingId: true },
  });
  return new Set(rows.map((row) => row.followingId));
};

/** Record something that happened to a user; nothing is stored for actions on yourself */
export const notify = async (input: {
  userId: string;
  actorId: string;
  type: NotificationType;
  gameId?: number | null;
  emoji?: string | null;
}) => {
  if (input.userId === input.actorId) return;
  try {
    await requireVisibleAuthor(input.actorId, input.userId);
  } catch (error) {
    if (error instanceof NotFoundError) return;
    throw error;
  }
  // Don't stack the same notification (a follow/unfollow/follow dance, repeated likes)
  await db
    .delete(notification)
    .where(
      and(
        eq(notification.userId, input.userId),
        eq(notification.actorId, input.actorId),
        eq(notification.type, input.type),
        input.gameId ? eq(notification.gameId, input.gameId) : sql`${notification.gameId} is null`,
      ),
    );
  await db.insert(notification).values({
    userId: input.userId,
    actorId: input.actorId,
    type: input.type,
    gameId: input.gameId ?? null,
    emoji: input.emoji ?? null,
  });
};
