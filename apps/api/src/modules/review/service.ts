import { and, count, eq, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { reviewLike, userGames } from "@playdamnit/db/schema";
import { GAME_CARD_COLUMNS, GAME_CARD_WITH, transformGameResponse } from "@/utils/gameTransformers";
import { NotFoundError } from "@/utils/errors";
import { notify, PUBLIC_USER_COLUMNS, visibleToViewer } from "@/utils/social";

export const REVIEW_SORTS = ["latest", "top"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

interface ListOptions {
  gameId?: number;
  userId?: string;
  /** Only reviews by people this user follows */
  followedBy?: string;
  viewerId: string | null;
  sort?: ReviewSort;
  limit: number;
  offset: number;
  /** Attach the game card (feeds); game pages already know the game */
  withGame?: boolean;
}

const likesCount = (userGameId: unknown) =>
  sql<number>`(select count(*) from ${reviewLike} where ${reviewLike.userGameId} = ${userGameId})`;

/**
 * Reviews are library entries with text. They are public when the author's list is public,
 * and always visible to the author.
 */
export abstract class ReviewService {
  static async list(opts: ListOptions) {
    const sort = opts.sort ?? "latest";
    const viewerId = opts.viewerId;

    const rows = await db.query.userGames.findMany({
      where: {
        review: { isNotNull: true },
        ...(opts.gameId && { gameId: opts.gameId }),
        ...(opts.userId && { userId: opts.userId }),
        RAW: (t) =>
          and(
            visibleToViewer(t.userId, viewerId),
            opts.followedBy
              ? sql`${t.userId} in (select following_id from user_follows where follower_id = ${opts.followedBy})`
              : sql`true`,
          )!,
      },
      orderBy: (t) =>
        sort === "top"
          ? [sql`${likesCount(t.id)} desc`, sql`${t.updatedAt} desc`]
          : [sql`${t.updatedAt} desc`],
      limit: opts.limit,
      offset: opts.offset,
      extras: {
        likes: (t) => likesCount(t.id).as("likes"),
        liked: (t) =>
          (viewerId
            ? sql<boolean>`exists (select 1 from ${reviewLike} where ${reviewLike.userGameId} = ${t.id} and ${reviewLike.userId} = ${viewerId})`
            : sql<boolean>`false`
          ).as("liked"),
      },
      with: {
        user: { columns: PUBLIC_USER_COLUMNS },
        ...(opts.withGame && { game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH } }),
      },
    });

    const [{ total }] = await db
      .select({ total: count() })
      .from(userGames)
      .where(
        and(
          sql`${userGames.review} is not null`,
          opts.gameId ? eq(userGames.gameId, opts.gameId) : undefined,
          opts.userId ? eq(userGames.userId, opts.userId) : undefined,
          visibleToViewer(userGames.userId, viewerId),
          opts.followedBy
            ? sql`${userGames.userId} in (select following_id from user_follows where follower_id = ${opts.followedBy})`
            : undefined,
        ),
      );

    return {
      results: rows.map((row) => ({
        id: row.id,
        gameId: row.gameId,
        user: row.user,
        rating: row.rating !== null ? Number(row.rating) : null,
        status: row.status,
        mastered: row.mastered,
        spoilers: row.spoilers,
        review: row.review!,
        platformId: row.platformId,
        endedAt: row.endedAt,
        addedAt: row.addedAt,
        updatedAt: row.updatedAt,
        likes: Number(row.likes),
        liked: !!row.liked,
        ...("game" in row && row.game ? { game: transformGameResponse(row.game) } : {}),
      })),
      meta: { total, limit: opts.limit, offset: opts.offset },
    };
  }

  static async like(userId: string, userGameId: string) {
    const entry = await db.query.userGames.findFirst({
      where: { id: userGameId, review: { isNotNull: true } },
      columns: { userId: true, gameId: true },
    });
    if (!entry) throw new NotFoundError("Review not found");
    await db.insert(reviewLike).values({ userId, userGameId }).onConflictDoNothing();
    await notify({
      userId: entry.userId,
      actorId: userId,
      type: "review_like",
      gameId: entry.gameId,
    });
    return { liked: true };
  }

  static async unlike(userId: string, userGameId: string) {
    await db
      .delete(reviewLike)
      .where(and(eq(reviewLike.userId, userId), eq(reviewLike.userGameId, userGameId)));
    return { liked: false };
  }
}
