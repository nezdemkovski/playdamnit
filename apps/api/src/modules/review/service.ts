import { and, count, eq, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { reviewReaction, userGames } from "@playdamnit/db/schema";
import { NotificationType, ReactionEmoji } from "@playdamnit/db/enums";
import { GAME_CARD_COLUMNS, GAME_CARD_WITH, transformGameResponse } from "@/utils/gameTransformers";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/utils/errors";
import { notify, PUBLIC_USER_COLUMNS, visibleToViewer } from "@/utils/social";
import { ReviewSort } from "@/utils/enums";
import { gradeOf } from "@/utils/grade";

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

const reactionCount = (userGameId: unknown) =>
  sql<number>`(select count(*) from ${reviewReaction} where ${reviewReaction.userGameId} = ${userGameId})`;

// `[{ emoji, count }]` in palette order, as JSON built by Postgres
const reactionSummary = (userGameId: unknown) =>
  sql<
    { emoji: string; count: number }[]
  >`(select coalesce(json_agg(json_build_object('emoji', r.emoji, 'count', r.n) order by r.n desc, r.emoji), '[]'::json) from (select ${reviewReaction.emoji} as emoji, count(*)::int as n from ${reviewReaction} where ${reviewReaction.userGameId} = ${userGameId} group by ${reviewReaction.emoji}) r)`;

/**
 * Reviews are library entries with text. They are public when the author's list is public,
 * and always visible to the author.
 */
export abstract class ReviewService {
  static async list(opts: ListOptions) {
    const sort = opts.sort ?? ReviewSort.Latest;
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
        sort === ReviewSort.Top
          ? [sql`${reactionCount(t.id)} desc`, sql`${t.updatedAt} desc`]
          : [sql`${t.updatedAt} desc`],
      limit: opts.limit,
      offset: opts.offset,
      extras: {
        likes: (t) => reactionCount(t.id).as("likes"),
        reactions: (t) => reactionSummary(t.id).as("reactions"),
        myReaction: (t) =>
          (viewerId
            ? sql<
                string | null
              >`(select ${reviewReaction.emoji} from ${reviewReaction} where ${reviewReaction.userGameId} = ${t.id} and ${reviewReaction.userId} = ${viewerId})`
            : sql<string | null>`null`
          ).as("my_reaction"),
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
        grade: gradeOf(row.rating),
        status: row.status,
        mastered: row.mastered,
        spoilers: row.spoilers,
        allowReactions: row.allowReactions,
        review: row.review!,
        platformId: row.platformId,
        endedAt: row.endedAt,
        addedAt: row.addedAt,
        updatedAt: row.updatedAt,
        likes: Number(row.likes),
        reactions: (row.reactions ?? []).map((r) => ({ emoji: r.emoji, count: Number(r.count) })),
        myReaction: row.myReaction ?? null,
        ...("game" in row && row.game ? { game: transformGameResponse(row.game) } : {}),
      })),
      meta: { total, limit: opts.limit, offset: opts.offset },
    };
  }

  /** Set (or change) the viewer's reaction; the author is told about it */
  static async react(userId: string, userGameId: string, emoji: string) {
    if (!Object.values<string>(ReactionEmoji).includes(emoji)) {
      throw new BadRequestError("Unknown reaction");
    }
    const entry = await db.query.userGames.findFirst({
      where: { id: userGameId, review: { isNotNull: true } },
      columns: { userId: true, gameId: true, allowReactions: true },
    });
    if (!entry) throw new NotFoundError("Review not found");
    if (!entry.allowReactions) throw new ForbiddenError("The author turned reactions off");
    await db
      .insert(reviewReaction)
      .values({ userId, userGameId, emoji: emoji as ReactionEmoji })
      .onConflictDoUpdate({
        target: [reviewReaction.userId, reviewReaction.userGameId],
        set: { emoji: emoji as ReactionEmoji, createdAt: new Date() },
      });
    await notify({
      userId: entry.userId,
      actorId: userId,
      type: NotificationType.ReviewReaction,
      gameId: entry.gameId,
      emoji,
    });
    return { reaction: emoji };
  }

  static async unreact(userId: string, userGameId: string) {
    await db
      .delete(reviewReaction)
      .where(and(eq(reviewReaction.userId, userId), eq(reviewReaction.userGameId, userGameId)));
    return { reaction: null };
  }
}
