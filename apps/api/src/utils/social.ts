import { and, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/db/postgres";
import { notification, user, userFollows } from "@playdamnit/db/schema";
import type { NotificationType } from "@playdamnit/db/enums";
import { NotFoundError } from "@/utils/errors";

export const PUBLIC_USER_COLUMNS = { id: true, username: true, name: true, image: true } as const;

export type PublicUser = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
};

/** Resolve a username to the row, or 404 */
export const requireUser = async (username: string) => {
  const row = await db.query.user.findFirst({
    where: { username },
    columns: { id: true, username: true, name: true, image: true, listPublic: true },
  });
  if (!row) throw new NotFoundError("User not found");
  return row;
};

/** Whether `viewerId` may see `owner`'s list, reviews and journal */
export const canSeeList = (owner: { id: string; listPublic: boolean }, viewerId: string | null) =>
  owner.listPublic || owner.id === viewerId;

/** SQL filter for library rows the viewer may see: public lists plus the viewer's own */
export const visibleToViewer = (userIdColumn: SQL | unknown, viewerId: string | null): SQL =>
  viewerId
    ? sql`(exists (select 1 from ${user} where ${user.id} = ${userIdColumn} and ${user.listPublic}) or ${userIdColumn} = ${viewerId})`
    : sql`exists (select 1 from ${user} where ${user.id} = ${userIdColumn} and ${user.listPublic})`;

export const isFollowing = async (followerId: string | null, followingId: string) => {
  if (!followerId || followerId === followingId) return false;
  const row = await db.query.userFollows.findFirst({
    where: { followerId, followingId },
    columns: { id: true },
  });
  return !!row;
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
