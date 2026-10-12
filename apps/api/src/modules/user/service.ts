import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import {
  gameList,
  notification,
  playthrough,
  user,
  userAvatar,
  userFollows,
  userGames,
} from "@playdamnit/db/schema";
import { NotificationType } from "@playdamnit/db/enums";
import { BadRequestError, NotFoundError } from "@/utils/errors";
import { ConnectionKind, JournalKind, MimeType, UrlProtocol, UserSort } from "@/utils/enums";
import { GAME_CARD_COLUMNS, GAME_CARD_WITH, transformGameResponse } from "@/utils/gameTransformers";
import { canSeeList, isFollowing, notify, PUBLIC_USER_COLUMNS, requireUser } from "@/utils/social";

const MAX_BIO = 300;
const MAX_LINKS = 5;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set<string>([MimeType.Jpeg, MimeType.Png, MimeType.Webp, MimeType.Gif]);

// Correlated to the outer "user" row; written by hand because Drizzle drops the qualifier on
// the main table's columns inside a subquery, which makes `id` ambiguous
const gamesCount = sql<number>`(select count(*) from user_games ug where ug.user_id = "user".id)`;
const followersCount = sql<number>`(select count(*) from user_follows uf where uf.following_id = "user".id)`;

/** The avatar URL the API serves, versioned so caches drop the old picture */
const avatarPath = (username: string, version: Date) =>
  `/api/user/${encodeURIComponent(username)}/avatar?v=${version.getTime()}`;

/**
 * User service - profiles, following, community search, notifications, avatars
 */
export abstract class UserService {
  /** Public profile with counts and the viewer's relationship to it */
  static async findByUsername(username: string, viewerId: string | null = null) {
    const data = await postgresDb.query.user.findFirst({
      where: { username },
    });
    if (!data) throw new NotFoundError("User not found");

    const [[games], [followers], [following], [reviews], [lists], follows, followsYou] =
      await Promise.all([
        postgresDb.select({ n: count() }).from(userGames).where(eq(userGames.userId, data.id)),
        postgresDb
          .select({ n: count() })
          .from(userFollows)
          .where(eq(userFollows.followingId, data.id)),
        postgresDb
          .select({ n: count() })
          .from(userFollows)
          .where(eq(userFollows.followerId, data.id)),
        postgresDb
          .select({ n: count() })
          .from(userGames)
          .where(and(eq(userGames.userId, data.id), sql`${userGames.review} is not null`)),
        postgresDb
          .select({ n: count() })
          .from(gameList)
          .where(
            and(
              eq(gameList.userId, data.id),
              data.id === viewerId ? undefined : eq(gameList.isPublic, true),
            ),
          ),
        isFollowing(viewerId, data.id),
        viewerId ? isFollowing(data.id, viewerId) : Promise.resolve(false),
      ]);

    return {
      id: data.id,
      image: data.image,
      name: data.name,
      username: data.username,
      bio: data.bio,
      links: data.links,
      listPublic: data.listPublic,
      createdAt: data.createdAt,
      counts: {
        games: Number(games.n),
        followers: Number(followers.n),
        following: Number(following.n),
        reviews: Number(reviews.n),
        lists: Number(lists.n),
      },
      isFollowing: follows,
      followsYou,
      isOwn: data.id === viewerId,
      // Everyone sees that Steam is connected; only the owner sees which account
      steamLinked: !!data.steamId,
      steamName: data.steamId ? data.steamName : null,
      steamProfileUrl: data.steamId ? data.steamProfileUrl : null,
      steamAvatarUrl: data.steamId ? data.steamAvatarUrl : null,
      steamId: data.id === viewerId ? data.steamId : null,
      steamSyncedAt: data.id === viewerId ? data.steamSyncedAt : null,
    };
  }

  /**
   * Find a user by ID
   */
  static async findById(userId: string) {
    const userData = await postgresDb.query.user.findFirst({
      where: { id: userId },
    });

    if (!userData) {
      throw new NotFoundError("User not found");
    }

    return {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      name: userData.name,
      image: userData.image,
      bio: userData.bio,
      links: userData.links,
      listPublic: userData.listPublic,
    };
  }

  static async updateProfile(
    userId: string,
    input: { bio?: string | null; links?: string[]; listPublic?: boolean },
  ) {
    if (input.bio && input.bio.length > MAX_BIO) {
      throw new BadRequestError(`Bio must be at most ${MAX_BIO} characters`);
    }
    const links = input.links?.map((l) => l.trim()).filter(Boolean);
    if (links) {
      if (links.length > MAX_LINKS) throw new BadRequestError(`At most ${MAX_LINKS} links`);
      for (const link of links) {
        let url: URL;
        try {
          url = new URL(link);
        } catch {
          throw new BadRequestError(`Not a URL: ${link}`);
        }
        if (url.protocol !== UrlProtocol.Https && url.protocol !== UrlProtocol.Http) {
          throw new BadRequestError(`Not a web link: ${link}`);
        }
      }
    }
    await postgresDb
      .update(user)
      .set({
        ...(input.bio !== undefined && { bio: input.bio?.trim() || null }),
        ...(links && { links }),
        ...(input.listPublic !== undefined && { listPublic: input.listPublic }),
      })
      .where(eq(user.id, userId));
    return UserService.findById(userId);
  }

  /** Community page: members with their list size and followers, optionally matched by name */
  static async search(opts: {
    q?: string;
    sort?: UserSort;
    limit: number;
    offset: number;
    viewerId: string | null;
  }) {
    const q = opts.q?.trim();
    const where = q ? or(ilike(user.username, `%${q}%`), ilike(user.name, `%${q}%`)) : undefined;
    const sort = opts.sort ?? UserSort.Games;
    const order =
      sort === UserSort.Followers
        ? [sql`${followersCount} desc`, desc(user.createdAt)]
        : sort === UserSort.Newest
          ? [desc(user.createdAt)]
          : [sql`${gamesCount} desc`, desc(user.createdAt)];

    const [rows, [{ total }]] = await Promise.all([
      postgresDb
        .select({
          id: user.id,
          username: user.username,
          name: user.name,
          image: user.image,
          bio: user.bio,
          gamesCount,
          followersCount,
          isFollowing: opts.viewerId
            ? sql<boolean>`exists (select 1 from user_follows uf where uf.follower_id = ${opts.viewerId} and uf.following_id = "user".id)`
            : sql<boolean>`false`,
        })
        .from(user)
        .where(where)
        .orderBy(...order)
        .limit(opts.limit)
        .offset(opts.offset),
      postgresDb.select({ total: count() }).from(user).where(where),
    ]);

    return {
      results: rows.map((row) => ({
        ...row,
        gamesCount: Number(row.gamesCount),
        followersCount: Number(row.followersCount),
        isFollowing: !!row.isFollowing,
      })),
      meta: { total, limit: opts.limit, offset: opts.offset },
    };
  }

  static async follow(followerId: string, username: string) {
    const target = await requireUser(username);
    if (target.id === followerId) throw new BadRequestError("You can't follow yourself");
    await postgresDb
      .insert(userFollows)
      .values({ followerId, followingId: target.id })
      .onConflictDoNothing();
    await notify({ userId: target.id, actorId: followerId, type: NotificationType.Follow });
    return { following: true };
  }

  static async unfollow(followerId: string, username: string) {
    const target = await requireUser(username);
    await postgresDb
      .delete(userFollows)
      .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, target.id)));
    return { following: false };
  }

  static async connections(
    username: string,
    kind: ConnectionKind,
    opts: { limit: number; offset: number; viewerId: string | null },
  ) {
    const target = await requireUser(username);
    const rows = await postgresDb.query.userFollows.findMany({
      where:
        kind === ConnectionKind.Followers ? { followingId: target.id } : { followerId: target.id },
      orderBy: { createdAt: "desc" },
      limit: opts.limit,
      offset: opts.offset,
      with: {
        follower: { columns: PUBLIC_USER_COLUMNS },
        following: { columns: PUBLIC_USER_COLUMNS },
      },
    });
    const [{ total }] = await postgresDb
      .select({ total: count() })
      .from(userFollows)
      .where(
        kind === ConnectionKind.Followers
          ? eq(userFollows.followingId, target.id)
          : eq(userFollows.followerId, target.id),
      );
    const users = rows.map((row) =>
      kind === ConnectionKind.Followers ? row.follower : row.following,
    );
    const following = await Promise.all(users.map((u) => isFollowing(opts.viewerId, u.id)));
    return {
      results: users.map((u, i) => ({ ...u, isFollowing: following[i] })),
      meta: { total, limit: opts.limit, offset: opts.offset },
    };
  }

  /** Just the count for the bell, without loading the notifications themselves */
  static async unreadNotifications(userId: string) {
    const [{ unread }] = await postgresDb
      .select({ unread: count() })
      .from(notification)
      .where(and(eq(notification.userId, userId), sql`${notification.readAt} is null`));
    return { unread: Number(unread) };
  }

  static async notifications(userId: string, opts: { limit: number }) {
    const [rows, [{ unread }]] = await Promise.all([
      postgresDb.query.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        limit: opts.limit,
        with: {
          actor: { columns: PUBLIC_USER_COLUMNS },
          game: { columns: { id: true, name: true, slug: true }, with: { cover: true } },
        },
      }),
      postgresDb
        .select({ unread: count() })
        .from(notification)
        .where(and(eq(notification.userId, userId), sql`${notification.readAt} is null`)),
    ]);
    return {
      results: rows.map((row) => ({
        id: row.id,
        type: row.type,
        actor: row.actor,
        game: row.game
          ? {
              id: row.game.id,
              name: row.game.name,
              slug: row.game.slug,
              cover: transformGameResponse({ ...row.game, platforms: [], genres: [] } as never)
                .cover,
            }
          : null,
        emoji: row.emoji,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
      unread: Number(unread),
    };
  }

  static async markNotificationsRead(userId: string) {
    await postgresDb
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.userId, userId), sql`${notification.readAt} is null`));
    return { ok: true };
  }

  /** What the people you follow did lately (entries added or changed) */
  static async feed(userId: string, opts: { limit: number; offset: number }) {
    const rows = await postgresDb.query.userGames.findMany({
      where: {
        RAW: (t) =>
          sql`${t.userId} in (select ${userFollows.followingId} from ${userFollows} where ${userFollows.followerId} = ${userId}) and exists (select 1 from ${user} where ${user.id} = ${t.userId} and ${user.listPublic})`,
      },
      orderBy: { updatedAt: "desc" },
      limit: opts.limit,
      offset: opts.offset,
      with: {
        user: { columns: PUBLIC_USER_COLUMNS },
        game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH },
      },
    });
    return {
      results: rows.map((row) => ({
        id: row.id,
        user: row.user,
        game: transformGameResponse(row.game),
        status: row.status,
        rating: row.rating !== null ? Number(row.rating) : null,
        mastered: row.mastered,
        hasReview: row.review !== null,
        at: row.updatedAt,
        isNew: row.updatedAt.getTime() - row.addedAt.getTime() < 1000,
      })),
    };
  }

  /** Journal: playthroughs plus finished/dropped entries without one, newest first */
  static async journal(username: string, viewerId: string | null, opts: { year?: number }) {
    const owner = await requireUser(username);
    if (!canSeeList(owner, viewerId)) return { results: [], private: true };

    const [runs, entries] = await Promise.all([
      postgresDb.query.playthrough.findMany({
        where: { userId: owner.id },
        with: {
          game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH },
          platform: true,
        },
      }),
      postgresDb.query.userGames.findMany({
        where: { userId: owner.id, endedAt: { isNotNull: true } },
        with: { game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH } },
      }),
    ]);

    const withRuns = new Set(runs.map((run) => run.gameId));
    const items = [
      ...runs.map((run) => ({
        id: run.id,
        kind: JournalKind.Playthrough as const,
        date: run.endedAt ?? run.startedAt ?? run.createdAt.toISOString().slice(0, 10),
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        hours: run.hours !== null ? Number(run.hours) : null,
        platform: run.platform,
        note: run.note,
        game: transformGameResponse(run.game),
      })),
      ...entries
        .filter((entry) => !withRuns.has(entry.gameId))
        .map((entry) => ({
          id: entry.id,
          kind: JournalKind.Entry as const,
          date: entry.endedAt!.toISOString().slice(0, 10),
          startedAt: null,
          endedAt: entry.endedAt!.toISOString().slice(0, 10),
          hours: null,
          platform: null,
          note: null,
          status: entry.status,
          rating: entry.rating !== null ? Number(entry.rating) : null,
          mastered: entry.mastered,
          game: transformGameResponse(entry.game),
        })),
    ]
      .filter((item) => !opts.year || item.date.startsWith(String(opts.year)))
      .sort((a, b) => b.date.localeCompare(a.date));

    return { results: items, private: false };
  }

  static async setAvatar(userId: string, file: File) {
    if (!AVATAR_TYPES.has(file.type))
      throw new BadRequestError("Avatar must be a JPEG, PNG, WebP or GIF");
    if (file.size > MAX_AVATAR_BYTES) throw new BadRequestError("Avatar must be under 2 MB");
    const me = await postgresDb.query.user.findFirst({
      where: { id: userId },
      columns: { username: true },
    });
    if (!me?.username) throw new BadRequestError("Set a username first");
    const data = new Uint8Array(await file.arrayBuffer());
    const now = new Date();
    await postgresDb.transaction(async (tx) => {
      await tx
        .insert(userAvatar)
        .values({ userId, contentType: file.type, data, updatedAt: now })
        .onConflictDoUpdate({
          target: userAvatar.userId,
          set: { contentType: file.type, data, updatedAt: now },
        });
      await tx
        .update(user)
        .set({ image: avatarPath(me.username!, now) })
        .where(eq(user.id, userId));
    });
    return { image: avatarPath(me.username, now) };
  }

  static async clearAvatar(userId: string) {
    await postgresDb.transaction(async (tx) => {
      await tx.delete(userAvatar).where(eq(userAvatar.userId, userId));
      await tx.update(user).set({ image: null }).where(eq(user.id, userId));
    });
    return { image: null };
  }

  static async avatar(username: string) {
    const owner = await requireUser(username);
    const row = await postgresDb.query.userAvatar.findFirst({ where: { userId: owner.id } });
    if (!row) throw new NotFoundError("No avatar");
    return row;
  }
}
