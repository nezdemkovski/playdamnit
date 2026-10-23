import { visibleAuthor, requireVisibleAuthor } from "@/modules/moderation/visibility";
import { checkPublicText } from "@/modules/moderation/filter";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import {
  game,
  gameList,
  notification,
  playthrough,
  steamPlaytime,
  user,
  userAvatar,
  userFollows,
  userGames,
} from "@playdamnit/db/schema";
import { MemberRole, NotificationType, UserGameStatus } from "@playdamnit/db/enums";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/utils/errors";
import {
  ActivityAction,
  BadgeId,
  ConnectionKind,
  JournalKind,
  MimeType,
  UrlProtocol,
  UserSort,
} from "@/utils/enums";
import { emptyGradeCounts, GRADE_BANDS, gradeIndexSql, gradeOf } from "@/utils/grade";
import { GAME_CARD_COLUMNS, GAME_CARD_WITH, transformGameResponse } from "@/utils/gameTransformers";
import {
  canSeeList,
  isFollowing,
  followedAmong,
  notify,
  PUBLIC_USER_COLUMNS,
  requireUser,
} from "@/utils/social";
import { safeZone } from "@/utils/timeZone";

const MAX_BIO = 300;
const MAX_LINKS = 5;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set<string>([MimeType.Jpeg, MimeType.Png, MimeType.Webp, MimeType.Gif]);

// Correlated to the outer "user" row; written by hand because Drizzle drops the qualifier on
// the main table's columns inside a subquery, which makes `id` ambiguous
const gamesCount = sql<number>`(select count(*) from user_games ug where ug.user_id = "user".id)`;
const followersCount = sql<number>`(select count(*) from user_follows uf where uf.following_id = "user".id)`;

type Executor = Pick<typeof postgresDb, "select">;

/** How many members follow this one: the profile's `followers` and the follow write's answer */
const followerCount = async (executor: Executor, userId: string) => {
  const [row] = await executor
    .select({ n: count() })
    .from(userFollows)
    .where(eq(userFollows.followingId, userId));
  return Number(row.n);
};

/** The avatar URL the API serves, versioned so caches drop the old picture */
const avatarPath = (username: string, version: Date) =>
  `/api/user/${encodeURIComponent(username)}/avatar?v=${version.getTime()}`;

/** Days the activity map covers by default: 52 weeks */
export const ACTIVITY_DAYS = 364;

const STATUSES = Object.values(UserGameStatus);

// Games named per action of a day; the rest is only counted
const ACTIVITY_NAMES = 4;

/** One action of a day: how many games, and the first few (Steam minutes for played ones) */
type ActivityGroup = { count: number; games: { name: string; minutes: number | null }[] };

type ActivityRow = {
  date: string;
  score: number;
  minutes: number;
  added: ActivityGroup;
  finished: ActivityGroup;
  dropped: ActivityGroup;
  updated: ActivityGroup;
  played: ActivityGroup;
};

/**
 * Levels 1-4 by the quartiles of the active days' scores, like GitHub: a busy year and a quiet
 * one both use the whole ramp
 */
const withLevels = <T extends { score: number }>(days: T[]) => {
  const active = days.map((d) => d.score).toSorted((a, b) => a - b);
  const cut = [0.25, 0.5, 0.75].map((q) => active[Math.floor((active.length - 1) * q)] ?? 0);
  return days.map(({ score, ...day }) => ({
    ...day,
    level: 1 + cut.filter((c) => score > c).length,
  }));
};

/**
 * User service - profiles, following, community search, notifications, avatars
 */
export abstract class UserService {
  /** Public profile with counts and the viewer's relationship to it */
  static async findByUsername(username: string, viewerId: string | null = null) {
    const data = await postgresDb.query.user.findFirst({
      where: { username },
    });
    if (!data) {
      throw new NotFoundError("User not found");
    }

    await requireVisibleAuthor(data.id, viewerId);

    // "This year" is the UTC calendar year (ended_at is kept in UTC), the same for every client
    const year = new Date().getUTCFullYear();
    const [[library], followers, [following], [lists], follows, followsYou] = await Promise.all([
      // The library in one pass: the counts everyone sees and the stats behind the badges
      postgresDb
        .select({
          total: count(),
          reviews: sql<number>`count(*) filter (where ${userGames.review} is not null)`,
          finished: sql<number>`count(*) filter (where ${userGames.status} = ${UserGameStatus.Finished})`,
          finishedThisYear: sql<number>`count(*) filter (where ${userGames.status} = ${UserGameStatus.Finished} and extract(year from ${userGames.endedAt}) = ${year})`,
          graded: sql<number>`count(*) filter (where ${userGames.rating} > 0)`,
          mastered: sql<number>`count(*) filter (where ${userGames.mastered})`,
          // One count per status, in the enum's order
          statuses: sql<string[]>`array[${sql.join(
            STATUSES.map((status) => sql`count(*) filter (where ${userGames.status} = ${status})`),
            sql`, `,
          )}]`,
          // The median, not the mean: always a grade the person actually gave, and a mix of S
          // and F does not average out to a C nobody got. Of an even count, the higher one.
          median: sql<
            string | null
          >`percentile_disc(0.5) within group (order by ${userGames.rating} desc) filter (where ${userGames.rating} > 0)`,
          // One count per grade band, S first
          bands: sql<string[]>`array[${sql.join(
            GRADE_BANDS.map(
              (_, i) => sql`count(*) filter (where ${gradeIndexSql(userGames.rating)} = ${i})`,
            ),
            sql`, `,
          )}]`,
        })
        .from(userGames)
        .where(eq(userGames.userId, data.id)),
      followerCount(postgresDb, data.id),
      postgresDb
        .select({ n: count() })
        .from(userFollows)
        .where(eq(userFollows.followerId, data.id)),
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

    const total = Number(library.total);
    const reviews = Number(library.reviews);
    const gradeCounts = emptyGradeCounts();
    GRADE_BANDS.forEach((band, i) => (gradeCounts[band.grade] = Number(library.bands[i])));
    const stats = {
      total,
      finished: Number(library.finished),
      graded: Number(library.graded),
      mastered: Number(library.mastered),
      year,
      finishedThisYear: Number(library.finishedThisYear),
      typicalGrade: gradeOf(library.median),
      gradeCounts,
      statusCounts: Object.fromEntries(
        STATUSES.map((status, i) => [status, Number(library.statuses[i])]),
      ) as Record<UserGameStatus, number>,
    };
    // Same rules on every client: thresholds on the numbers above
    const badges = (
      [
        [BadgeId.First, total >= 1],
        [BadgeId.Collector, total >= 50],
        [BadgeId.Hoarder, total >= 200],
        [BadgeId.Finisher, stats.finished >= 10],
        [BadgeId.Closer, stats.finished >= 50],
        [BadgeId.Critic, stats.graded >= 25],
        [BadgeId.Writer, reviews >= 10],
        [BadgeId.Completionist, stats.mastered >= 5],
        [BadgeId.Year, stats.finishedThisYear >= 12],
      ] as const
    ).map(([id, earned]) => ({ id, earned }));
    // A private library keeps its numbers to its owner
    const showLibrary = canSeeList(data, viewerId);

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
        games: total,
        followers,
        following: Number(following.n),
        reviews,
        lists: Number(lists.n),
      },
      stats: showLibrary ? stats : null,
      badges: showLibrary ? badges : null,
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
    const [userData, platforms] = await Promise.all([
      postgresDb.query.user.findFirst({ where: { id: userId } }),
      postgresDb
        .select({ id: userGames.platformId })
        .from(userGames)
        .where(and(eq(userGames.userId, userId), sql`${userGames.platformId} is not null`))
        .groupBy(userGames.platformId)
        .orderBy(desc(count()), userGames.platformId),
    ]);

    if (!userData) {
      throw new NotFoundError("User not found");
    }

    return {
      id: userData.id,
      isModerator: userData.role === MemberRole.Admin,
      username: userData.username,
      email: userData.email,
      name: userData.name,
      image: userData.image,
      steamAvatarUrl: userData.steamId ? userData.steamAvatarUrl : null,
      bio: userData.bio,
      links: userData.links,
      listPublic: userData.listPublic,
      // The linked Steam account, as the profile shows it to its owner
      steamId: userData.steamId,
      steamName: userData.steamId ? userData.steamName : null,
      // The platforms the member logs games on, most used first: a new entry goes on the first
      // of these the game is on
      preferredPlatformIds: platforms.map((p) => p.id!),
    };
  }

  static async updateProfile(
    userId: string,
    input: { bio?: string | null; links?: string[]; listPublic?: boolean },
  ) {
    checkPublicText(input.bio);
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
    const where = and(
      visibleAuthor(user.id, opts.viewerId),
      q ? or(ilike(user.username, `%${q}%`), ilike(user.name, `%${q}%`)) : undefined,
    );
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
          steamAvatarUrl: user.steamAvatarUrl,
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

  /** Follow a member; answers with their follower count after the write */
  static async follow(followerId: string, username: string) {
    const target = await requireUser(username, followerId);
    if (target.id === followerId) throw new BadRequestError("You can't follow yourself");
    const followers = await postgresDb.transaction(async (tx) => {
      await tx
        .insert(userFollows)
        .values({ followerId, followingId: target.id })
        .onConflictDoNothing();
      return followerCount(tx, target.id);
    });
    await notify({ userId: target.id, actorId: followerId, type: NotificationType.Follow });
    return { following: true, followers };
  }

  /** Stop following; answers with the target's follower count after the write */
  static async unfollow(followerId: string, username: string) {
    const target = await requireUser(username, followerId);
    const followers = await postgresDb.transaction(async (tx) => {
      await tx
        .delete(userFollows)
        .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, target.id)));
      return followerCount(tx, target.id);
    });
    return { following: false, followers };
  }

  static async connections(
    username: string,
    kind: ConnectionKind,
    opts: { limit: number; offset: number; viewerId: string | null },
  ) {
    const target = await requireUser(username, opts.viewerId);
    const followers = kind === ConnectionKind.Followers;
    const where = (t: Pick<typeof userFollows, "followerId" | "followingId">) => {
      return and(
        eq(followers ? t.followingId : t.followerId, target.id),
        visibleAuthor(followers ? t.followerId : t.followingId, opts.viewerId),
      )!;
    };
    const [rows, [{ total }]] = await Promise.all([
      postgresDb.query.userFollows.findMany({
        where: { RAW: (t) => where(t) },
        orderBy: { createdAt: "desc" },
        limit: opts.limit,
        offset: opts.offset,
        with: {
          follower: { columns: PUBLIC_USER_COLUMNS },
          following: { columns: PUBLIC_USER_COLUMNS },
        },
      }),
      postgresDb.select({ total: count() }).from(userFollows).where(where(userFollows)),
    ]);
    const users = rows.map((row) =>
      kind === ConnectionKind.Followers ? row.follower : row.following,
    );
    const followed = await followedAmong(
      opts.viewerId,
      users.map((u) => u.id),
    );
    return {
      results: users.map((u) => ({ ...u, isFollowing: followed.has(u.id) })),
      meta: { total, limit: opts.limit, offset: opts.offset },
    };
  }

  /** Just the count for the bell, without loading the notifications themselves */
  static async unreadNotifications(userId: string) {
    const [{ unread }] = await postgresDb
      .select({ unread: count() })
      .from(notification)
      .where(
        and(
          eq(notification.userId, userId),
          visibleAuthor(notification.actorId, userId),
          sql`${notification.readAt} is null`,
        ),
      );
    return { unread: Number(unread) };
  }

  static async notifications(userId: string, opts: { limit: number }) {
    const [rows, [{ unread }]] = await Promise.all([
      postgresDb.query.notification.findMany({
        where: { userId, RAW: (t) => visibleAuthor(t.actorId, userId) },
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
        .where(
          and(
            eq(notification.userId, userId),
            visibleAuthor(notification.actorId, userId),
            sql`${notification.readAt} is null`,
          ),
        ),
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
      .where(
        and(
          eq(notification.userId, userId),
          visibleAuthor(notification.actorId, userId),
          sql`${notification.readAt} is null`,
        ),
      );
    return { ok: true };
  }

  /** Idempotent dismissal, scoped in SQL to the recipient (including hidden notifications). */
  static async deleteNotification(userId: string, id: string) {
    await postgresDb
      .delete(notification)
      .where(and(eq(notification.userId, userId), eq(notification.id, id)));
    return { ok: true, ...(await this.unreadNotifications(userId)) };
  }

  /** The whole inbox, including notifications beyond the client's loaded page. */
  static async clearNotifications(userId: string) {
    await postgresDb.delete(notification).where(eq(notification.userId, userId));
    return { ok: true, ...(await this.unreadNotifications(userId)) };
  }

  /** What the people you follow did lately (entries added or changed) */
  static async feed(userId: string, opts: { limit: number; offset: number }) {
    const rows = await postgresDb.query.userGames.findMany({
      where: {
        RAW: (t) =>
          sql`${t.userId} in (select ${userFollows.followingId} from ${userFollows} where ${userFollows.followerId} = ${userId}) and exists (select 1 from ${user} where ${user.id} = ${t.userId} and ${user.listPublic}) and ${visibleAuthor(t.userId, userId)}`,
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
        grade: gradeOf(row.rating),
        mastered: row.mastered,
        hasReview: row.review !== null,
        at: row.updatedAt,
        isNew: row.updatedAt.getTime() - row.addedAt.getTime() < 1000,
      })),
    };
  }

  /**
   * The activity map: every day of the last `days` (in the member's zone) on which they added,
   * finished, dropped or edited a game or played it on Steam, with the games and a level 1-4.
   * An edit counts unless it was the add or the finish itself; every action counts once and
   * Steam play once per started hour per game. One query; days with nothing are left out.
   */
  static async activity(
    username: string,
    viewerId: string | null,
    opts: { days?: number; tz?: string },
  ) {
    const owner = await requireUser(username, viewerId);
    if (!canSeeList(owner, viewerId)) throw new ForbiddenError("This list is private");
    const tz = safeZone(opts.tz);
    const span = opts.days ?? ACTIVITY_DAYS;
    // Moments become days in the member's zone; the end date is a calendar date already
    const local = (column: unknown) =>
      sql`((${column} at time zone 'UTC') at time zone ${tz})::date`;
    const rows = await postgresDb.execute<ActivityRow>(sql`
      with bounds as (
        select (now() at time zone ${tz})::date as today
      ),
      entries as (
        select ${game.name} as name, ${userGames.updatedAt} as at,
          ${local(userGames.addedAt)} as added,
          case ${userGames.status}
            when ${UserGameStatus.Finished} then ${ActivityAction.Finished}::text
            when ${UserGameStatus.Dropped} then ${ActivityAction.Dropped}::text
          end as ending,
          ${userGames.endedAt}::date as ended,
          ${local(userGames.updatedAt)} as updated
        from ${userGames}
        join ${game} on ${game.id} = ${userGames.gameId}
        where ${userGames.userId} = ${owner.id}
      ),
      events as (
        select added as day, ${ActivityAction.Added}::text as action, name, null::int as minutes, at
        from entries
        union all
        select ended, ending, name, null, at from entries where ending is not null and ended is not null
        union all
        select updated, ${ActivityAction.Updated}::text, name, null, at from entries
          where updated <> added and (ending is null or updated is distinct from ended)
        union all
        select ${steamPlaytime.day}, ${ActivityAction.Played}::text, ${game.name}, ${steamPlaytime.minutes}, null
        from ${steamPlaytime}
        join ${game} on ${game.id} = ${steamPlaytime.gameId}
        where ${steamPlaytime.userId} = ${owner.id}
          and ${steamPlaytime.day} > (select today from bounds) - ${span}::int
      )
      select to_char(day, 'YYYY-MM-DD') as date,
        (count(*) filter (where action <> ${ActivityAction.Played})
          + coalesce(sum(greatest(1, ceil(minutes / 60.0))), 0))::int as score,
        coalesce(sum(minutes), 0)::int as minutes,
        json_build_object('count', count(*) filter (where action = ${ActivityAction.Added}), 'games',
          coalesce((array_agg(json_build_object('name', name, 'minutes', minutes) order by at desc)
            filter (where action = ${ActivityAction.Added}))[1:${ACTIVITY_NAMES}], '{}')) as added,
        json_build_object('count', count(*) filter (where action = ${ActivityAction.Finished}), 'games',
          coalesce((array_agg(json_build_object('name', name, 'minutes', minutes) order by at desc)
            filter (where action = ${ActivityAction.Finished}))[1:${ACTIVITY_NAMES}], '{}')) as finished,
        json_build_object('count', count(*) filter (where action = ${ActivityAction.Dropped}), 'games',
          coalesce((array_agg(json_build_object('name', name, 'minutes', minutes) order by at desc)
            filter (where action = ${ActivityAction.Dropped}))[1:${ACTIVITY_NAMES}], '{}')) as dropped,
        json_build_object('count', count(*) filter (where action = ${ActivityAction.Updated}), 'games',
          coalesce((array_agg(json_build_object('name', name, 'minutes', minutes) order by at desc)
            filter (where action = ${ActivityAction.Updated}))[1:${ACTIVITY_NAMES}], '{}')) as updated,
        json_build_object('count', count(*) filter (where action = ${ActivityAction.Played}), 'games',
          coalesce((array_agg(json_build_object('name', name, 'minutes', minutes) order by minutes desc)
            filter (where action = ${ActivityAction.Played}))[1:${ACTIVITY_NAMES}], '{}')) as played
      from events, bounds
      where day > today - ${span}::int and day <= today
      group by day
      order by day
    `);
    return { days: withLevels(rows.rows.map((r) => ({ ...r, score: Number(r.score) }))) };
  }

  /**
   * Journal: playthroughs plus finished/dropped entries without one, newest first. Paged when
   * `limit` is given (the whole journal otherwise); `years` always covers the whole journal.
   */
  static async journal(
    username: string,
    viewerId: string | null,
    opts: { year?: number; limit?: number; offset?: number },
  ) {
    const owner = await requireUser(username, viewerId);
    if (!canSeeList(owner, viewerId)) {
      return {
        results: [],
        years: [],
        private: true,
        meta: { total: 0, limit: opts.limit ?? 0, offset: opts.offset ?? 0 },
      };
    }

    // One query for the page's ids, the total under the year filter and every year the journal
    // has. A playthrough's day is when it ended, else began, else was logged; an entry counts
    // only when it is finished and the game has no playthroughs (those stand in for it).
    const { rows } = await postgresDb.execute<{
      years: number[];
      total: number;
      page: { kind: JournalKind; id: string }[];
    }>(sql`
      with items as (
        select ${JournalKind.Playthrough}::text as kind, p.id::text as id,
          coalesce(p.ended_at, p.started_at, p.created_at::date) as day
        from ${playthrough} p
        where p.user_id = ${owner.id}
        union all
        select ${JournalKind.Entry}::text, ug.id::text, ug.ended_at::date
        from ${userGames} ug
        where ug.user_id = ${owner.id} and ug.ended_at is not null
          and not exists (
            select 1 from ${playthrough} p where p.user_id = ug.user_id and p.game_id = ug.game_id
          )
      ),
      filtered as (
        select * from items
        where ${opts.year ?? null}::int is null or extract(year from day) = ${opts.year ?? null}::int
      )
      select
        (select coalesce(json_agg(y order by y desc), '[]'::json)
          from (select distinct extract(year from day)::int as y from items) ys) as years,
        (select count(*)::int from filtered) as total,
        (select coalesce(json_agg(json_build_object('kind', kind, 'id', id) order by day desc, kind, id), '[]'::json)
          from (select * from filtered order by day desc, kind, id
                limit ${opts.limit ?? null}::int offset ${opts.offset ?? 0}::int) pg) as page
    `);
    const { years, total, page } = rows[0];

    const runIds = page.filter((i) => i.kind === JournalKind.Playthrough).map((i) => i.id);
    const entryIds = page.filter((i) => i.kind === JournalKind.Entry).map((i) => i.id);
    const [runs, entries] = await Promise.all([
      runIds.length
        ? postgresDb.query.playthrough.findMany({
            where: { id: { in: runIds } },
            with: {
              game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH },
              platform: true,
            },
          })
        : Promise.resolve([]),
      entryIds.length
        ? postgresDb.query.userGames.findMany({
            where: { id: { in: entryIds } },
            with: { game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH } },
          })
        : Promise.resolve([]),
    ]);

    const toRun = (run: (typeof runs)[number]) => ({
      id: run.id,
      kind: JournalKind.Playthrough as const,
      date: run.endedAt ?? run.startedAt ?? run.createdAt.toISOString().slice(0, 10),
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      hours: run.hours !== null ? Number(run.hours) : null,
      platform: run.platform,
      note: run.note,
      game: transformGameResponse(run.game),
    });
    const toEntry = (entry: (typeof entries)[number], day: string) => ({
      id: entry.id,
      kind: JournalKind.Entry as const,
      date: day,
      startedAt: null,
      endedAt: day,
      hours: null,
      platform: null,
      note: null,
      status: entry.status,
      rating: entry.rating !== null ? Number(entry.rating) : null,
      grade: gradeOf(entry.rating),
      mastered: entry.mastered,
      game: transformGameResponse(entry.game),
    });
    const runById = new Map(runs.map((run) => [run.id, run]));
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    const results = page.flatMap(
      (item): (ReturnType<typeof toRun> | ReturnType<typeof toEntry>)[] => {
        if (item.kind === JournalKind.Playthrough) {
          const run = runById.get(item.id);
          return run ? [toRun(run)] : [];
        }
        const entry = entryById.get(item.id);
        return entry?.endedAt ? [toEntry(entry, entry.endedAt.toISOString().slice(0, 10))] : [];
      },
    );

    return {
      results,
      years,
      private: false,
      meta: { total, limit: opts.limit ?? total, offset: opts.offset ?? 0 },
    };
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
    const owner = await postgresDb.query.user.findFirst({
      where: { username },
      columns: { id: true },
    });
    if (!owner) throw new NotFoundError("User not found");
    const row = await postgresDb.query.userAvatar.findFirst({ where: { userId: owner.id } });
    if (!row) throw new NotFoundError("No avatar");
    return row;
  }
}
