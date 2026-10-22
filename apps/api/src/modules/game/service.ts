import { verdictOf } from "./verdict";
import { and, count, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "@/db/postgres";
import {
  cover,
  game,
  gameLike,
  gameList,
  gameListItem,
  gameToGenre,
  gameToPlatform,
  userGames,
} from "@playdamnit/db/schema";
import { UserGameStatus } from "@playdamnit/db/enums";
import {
  GAME_CARD_COLUMNS,
  GAME_CARD_WITH,
  GAME_DETAIL_COLUMNS,
  GAME_DETAIL_WITH,
  GAME_RELATED_COLUMNS,
  transformGameDetail,
  transformGameResponse,
} from "@/utils/gameTransformers";
import { NotFoundError } from "@/utils/errors";
import { GameSort } from "@/utils/enums";
import { emptyGradeCounts, gradeOf } from "@/utils/grade";
import { getImageUrl, IgdbImageSize } from "@/utils/image";
import { toUserGameData } from "@/modules/userGame/entry";

export const MAX_GAMES_PAGE_SIZE = 100;
const SIMILAR_GAMES_LIMIT = 12;
const DAY_SECONDS = 86_400;
// Covers per day on the release calendar
const RELEASE_DAY_COVERS = 4;
// "Best" needs enough IGDB votes to mean anything
const MIN_RATINGS_FOR_BEST = 50;
// Unreleased games have no ratings yet; this many IGDB follows before release make one "hot"
const HOT_HYPES = 10;
// How long a page's total is reused: the catalog changes overnight, and counting the whole
// catalog (no filter, or a wide one) costs 30ms+ on every page of a rail that never pages
const TOTAL_TTL_MS = 5 * 60_000;
const TOTAL_CACHE_SIZE = 500;
const totals = new Map<string, { total: number; at: number }>();

/** Counts the matches for these filters, or reuses a count made in the last few minutes */
const cachedTotal = async (opts: GameFilters, sort: GameSort) => {
  const { limit: _limit, offset: _offset, ...filters } = opts;
  const key = JSON.stringify([sort, filters]);
  const hit = totals.get(key);
  if (hit && Date.now() - hit.at < TOTAL_TTL_MS) return hit.total;
  const [{ total }] = await db
    .select({ total: count() })
    .from(game)
    .where(and(isNull(game.deletedAt), ...buildFilters({ ...filters, sort }, game)));
  if (totals.size >= TOTAL_CACHE_SIZE) totals.delete(totals.keys().next().value!);
  totals.set(key, { total, at: Date.now() });
  return total;
};

export interface GameFilters {
  limit?: number;
  offset?: number;
  platformId?: number;
  genreId?: number;
  /** Release year */
  year?: number;
  /** Unix seconds, inclusive */
  releasedFrom?: number;
  releasedTo?: number;
  /** IGDB game_type ids */
  types?: number[];
  ids?: number[];
  /** Only hot games: popular by ratings, or anticipated by follows before release */
  popular?: boolean;
  /** Only games in this member's library */
  ownerId?: string;
  sort?: GameSort;
}

// A minimal view of the aliased game table RQB hands to `where`/`orderBy` callbacks
type GameRef = {
  id: unknown;
  firstReleaseDate: unknown;
  gameType: unknown;
  totalRating: unknown;
  totalRatingCount: unknown;
  isPopular: unknown;
  hypes: unknown;
};

const yearBounds = (year: number) => ({
  from: Math.floor(Date.UTC(year, 0, 1) / 1000),
  to: Math.floor(Date.UTC(year + 1, 0, 1) / 1000) - 1,
});

const hasCover = (t: GameRef) =>
  sql`exists (select 1 from ${cover} where ${cover.gameId} = ${t.id})`;

// The statuses a member-based sort counts; every status for "played"
const MEMBER_SORT_STATUSES: Partial<Record<GameSort, readonly UserGameStatus[]>> = {
  [GameSort.Wanted]: [UserGameStatus.WantToPlay, UserGameStatus.Backlog],
};

const inMemberLists = (t: GameRef, statuses?: readonly UserGameStatus[]) =>
  statuses
    ? sql`exists (select 1 from ${userGames} where ${userGames.gameId} = ${t.id} and ${userGames.status} in ${statuses})`
    : sql`exists (select 1 from ${userGames} where ${userGames.gameId} = ${t.id})`;

/** Every filter as SQL against the given table reference (RQB aliases the table) */
const buildFilters = (opts: GameFilters, t: GameRef): SQL[] => {
  const filters: SQL[] = [];
  const sort = opts.sort ?? GameSort.Id;
  if (opts.platformId) {
    filters.push(
      sql`exists (select 1 from ${gameToPlatform} where ${gameToPlatform.gameId} = ${t.id} and ${gameToPlatform.platformId} = ${opts.platformId})`,
    );
  }
  if (opts.genreId) {
    filters.push(
      sql`exists (select 1 from ${gameToGenre} where ${gameToGenre.gameId} = ${t.id} and ${gameToGenre.genreId} = ${opts.genreId})`,
    );
  }
  const from = opts.year ? yearBounds(opts.year).from : opts.releasedFrom;
  const to = opts.year ? yearBounds(opts.year).to : opts.releasedTo;
  if (from !== undefined) filters.push(sql`${t.firstReleaseDate} >= ${from}`);
  if (to !== undefined) filters.push(sql`${t.firstReleaseDate} <= ${to}`);
  if (opts.types?.length) filters.push(sql`${t.gameType} in ${opts.types}`);
  if (opts.ids?.length) filters.push(sql`${t.id} in ${opts.ids}`);
  if (opts.popular) filters.push(sql`(${t.isPopular} or ${t.hypes} >= ${HOT_HYPES})`);
  if (opts.ownerId) {
    filters.push(
      sql`exists (select 1 from ${userGames} where ${userGames.gameId} = ${t.id} and ${userGames.userId} = ${opts.ownerId})`,
    );
  }
  if (sort === GameSort.Recent) {
    filters.push(sql`${t.firstReleaseDate} <= extract(epoch from now())::bigint`, hasCover(t));
  }
  if (sort === GameSort.Upcoming) {
    filters.push(sql`${t.firstReleaseDate} > extract(epoch from now())::bigint`, hasCover(t));
  }
  if (sort === GameSort.Rating) {
    filters.push(sql`${t.totalRatingCount} >= ${MIN_RATINGS_FOR_BEST}`);
  }
  // The release calendar: dated games with a cover, in date order within the range given
  if (sort === GameSort.Date) {
    filters.push(sql`${t.firstReleaseDate} is not null`, hasCover(t));
  }
  return filters;
};

const orderFor = (sort: GameSort) => (t: GameRef) => {
  const popularity = sql`${t.totalRatingCount} desc nulls last`;
  switch (sort) {
    case GameSort.Popular:
      // Ratings first; for unreleased games (no ratings yet) the follows decide
      return [sql`${t.isPopular} desc`, popularity, sql`${t.hypes} desc nulls last`, sql`${t.id}`];
    case GameSort.Rating:
      return [sql`${t.totalRating} desc nulls last`, popularity];
    case GameSort.Recent:
      return [sql`${t.firstReleaseDate} desc`, popularity];
    case GameSort.Upcoming:
    case GameSort.Date:
      return [sql`${t.firstReleaseDate} asc`, popularity];
    // Wanted and Played rank by members first (findByMembers); what follows them goes by popularity
    case GameSort.Wanted:
    case GameSort.Played:
      return [popularity, sql`${t.id}`];
    default:
      return [sql`${t.id} asc`];
  }
};

// Live games that point at `id` through the given parent column (DLC → parent_game,
// editions → version_parent)
const findRelated = (column: "parentGameId" | "versionParentId", id: number) =>
  db.query.game.findMany({
    where: { [column]: id, deletedAt: { isNull: true } },
    orderBy: { firstReleaseDate: "asc" },
    columns: GAME_RELATED_COLUMNS,
    with: { cover: true },
  });

type Executor = Pick<typeof db, "select">;

/** How many members liked a game: the detail's `community.likes` and the like write's answer */
const likeCount = async (executor: Executor, gameId: number) => {
  const [row] = await executor
    .select({ n: count() })
    .from(gameLike)
    .where(eq(gameLike.gameId, gameId));
  return Number(row.n);
};

/** What this site's members did with the game: status counts, ratings, likes, lists */
const communityStats = async (gameId: number) => {
  const [statusRows, [ratings], likes, [lists], histogramRows] = await Promise.all([
    db
      .select({ status: userGames.status, mastered: userGames.mastered, n: count() })
      .from(userGames)
      .where(eq(userGames.gameId, gameId))
      .groupBy(userGames.status, userGames.mastered),
    db
      .select({
        avg: sql<string | null>`avg(${userGames.rating})`,
        n: sql<number>`count(${userGames.rating})`,
        reviews: sql<number>`count(${userGames.review})`,
      })
      .from(userGames)
      .where(and(eq(userGames.gameId, gameId), sql`${userGames.rating} > 0`)),
    likeCount(db, gameId),
    db
      .select({ n: count() })
      .from(gameListItem)
      .innerJoin(gameList, eq(gameList.id, gameListItem.listId))
      .where(and(eq(gameListItem.gameId, gameId), eq(gameList.isPublic, true))),
    db
      .select({
        bucket: sql<number>`least(10, greatest(1, floor(${userGames.rating})))::int`,
        n: count(),
      })
      .from(userGames)
      .where(and(eq(userGames.gameId, gameId), sql`${userGames.rating} > 0`))
      .groupBy(sql`1`),
  ]);

  const statuses = Object.fromEntries(Object.values(UserGameStatus).map((s) => [s, 0])) as Record<
    UserGameStatus,
    number
  >;
  let mastered = 0;
  let total = 0;
  for (const row of statusRows) {
    statuses[row.status] += Number(row.n);
    total += Number(row.n);
    if (row.mastered) mastered += Number(row.n);
  }
  const histogram = Array.from({ length: 10 }, () => 0);
  // Bands start on whole numbers, so each whole-number bucket falls in exactly one grade
  const gradeCounts = emptyGradeCounts();
  for (const row of histogramRows) {
    histogram[Number(row.bucket) - 1] = Number(row.n);
    gradeCounts[gradeOf(row.bucket)!] += Number(row.n);
  }
  const ratingAverage = ratings.avg ? Math.round(Number(ratings.avg) * 10) / 10 : null;

  const [[reviewCount], catalog] = await Promise.all([
    db
      .select({ n: count() })
      .from(userGames)
      .where(and(eq(userGames.gameId, gameId), sql`${userGames.review} is not null`)),
    db.query.game.findFirst({
      where: { id: gameId },
      columns: { totalRating: true, totalRatingCount: true },
    }),
  ]);

  return {
    total,
    statuses,
    mastered,
    verdict: verdictOf(
      catalog?.totalRating ?? null,
      catalog?.totalRatingCount ?? null,
      ratingAverage,
      Number(ratings.n),
    ),
    ratingAverage,
    /** The members' grade: the average's */
    grade: gradeOf(ratingAverage),
    ratingCount: Number(ratings.n),
    histogram,
    gradeCounts,
    reviews: Number(reviewCount.n),
    likes,
    lists: Number(lists.n),
  };
};

/**
 * Game service - handles all business logic for game operations
 */
export abstract class GameService {
  /**
   * Find a single game by ID. Deleted games are still served (libraries reference them) with
   * `deleted: true`. `viewerId` adds the viewer's like state and library entry.
   */
  static async findById(gameId: number, viewerId: string | null = null) {
    const result = await db.query.game.findFirst({
      where: { id: gameId },
      columns: GAME_DETAIL_COLUMNS,
      with: GAME_DETAIL_WITH,
    });

    if (!result) {
      throw new NotFoundError("Game not found");
    }

    const similarIds = (result.similarGameIds ?? []).slice(0, SIMILAR_GAMES_LIMIT);
    const [children, editions, similar, community, liked, entry] = await Promise.all([
      findRelated("parentGameId", gameId),
      findRelated("versionParentId", gameId),
      similarIds.length
        ? db.query.game.findMany({
            where: { id: { in: similarIds }, deletedAt: { isNull: true } },
            columns: GAME_CARD_COLUMNS,
            with: GAME_CARD_WITH,
          })
        : Promise.resolve([]),
      communityStats(gameId),
      viewerId
        ? db.query.gameLike.findFirst({
            where: { userId: viewerId, gameId },
            columns: { gameId: true },
          })
        : Promise.resolve(undefined),
      viewerId
        ? db.query.userGames.findFirst({ where: { userId: viewerId, gameId } })
        : Promise.resolve(undefined),
    ]);

    const byId = new Map(similar.map((g) => [g.id, g]));
    const detail = transformGameDetail(result, { children, editions });
    return {
      ...detail,
      // Cards in IGDB's order, only the ones the catalog has
      similarGames: similarIds.flatMap((id) => {
        const g = byId.get(id);
        return g ? [transformGameResponse(g)] : [];
      }),
      community,
      viewer: { liked: !!liked, entry: entry ? toUserGameData(entry) : null },
    };
  }

  /**
   * Browse the catalog: filters by platform, genre, year/date range, type and ids; sorts by
   * IGDB popularity or rating, release date (recent/upcoming) or this site's members
   * (wanted/played). Deleted games are excluded.
   */
  /**
   * A page of the catalog with its total. `withTotal: false` skips counting the matches (a rail
   * that never pages); the total is then the page's own length.
   */
  static async findGames(opts: GameFilters, { withTotal = true }: { withTotal?: boolean } = {}) {
    const limit = Math.min(opts.limit ?? MAX_GAMES_PAGE_SIZE, MAX_GAMES_PAGE_SIZE);
    const offset = opts.offset ?? 0;
    const sort = opts.sort ?? GameSort.Id;

    if (sort === GameSort.Wanted || sort === GameSort.Played) {
      return GameService.findByMembers(opts, sort, limit, offset);
    }

    const [games, total] = await Promise.all([
      db.query.game.findMany({
        limit,
        offset,
        where: {
          deletedAt: { isNull: true },
          RAW: (t) => and(...buildFilters(opts, t)) ?? sql`true`,
        },
        orderBy: orderFor(sort),
        columns: GAME_CARD_COLUMNS,
        with: GAME_CARD_WITH,
      }),
      withTotal ? cachedTotal(opts, sort) : Promise.resolve(null),
    ]);

    return {
      results: games.map(transformGameResponse),
      meta: { total: total ?? games.length, limit, offset },
    };
  }

  /**
   * Wanted and Played: the games in members' lists, most members first, then the rest of the
   * catalog by popularity, so the chart never runs dry. Counting per game over the members'
   * entries is cheap; counting per row over the whole catalog (the old order by subquery) took
   * seconds.
   */
  private static async findByMembers(
    opts: GameFilters,
    sort: GameSort,
    limit: number,
    offset: number,
  ) {
    const statuses = MEMBER_SORT_STATUSES[sort];
    const members = count(userGames.id);
    const ranked = await db
      .select({ id: userGames.gameId })
      .from(userGames)
      .innerJoin(game, eq(game.id, userGames.gameId))
      .where(
        and(
          isNull(game.deletedAt),
          statuses ? inArray(userGames.status, [...statuses]) : undefined,
          ...buildFilters(opts, game),
        ),
      )
      .groupBy(userGames.gameId, game.totalRatingCount)
      .orderBy(desc(members), sql`${game.totalRatingCount} desc nulls last`, userGames.gameId);

    const ids = ranked.map((r) => r.id).slice(offset, offset + limit);
    const rest = limit - ids.length;
    // Past the members' games the page continues with the rest of the catalog
    const restOfCatalog = async () => {
      if (rest <= 0) return [];
      const rows = await db.query.game.findMany({
        limit: rest,
        offset: Math.max(0, offset - ranked.length),
        where: {
          deletedAt: { isNull: true },
          RAW: (t) =>
            and(sql`not ${inMemberLists(t, statuses)}`, ...buildFilters(opts, t)) ?? sql`true`,
        },
        orderBy: orderFor(sort),
        columns: GAME_CARD_COLUMNS,
        with: GAME_CARD_WITH,
      });
      return rows.map(transformGameResponse);
    };
    const [cards, others, [{ total }]] = await Promise.all([
      GameService.findCards(ids),
      restOfCatalog(),
      db
        .select({ total: count() })
        .from(game)
        .where(and(isNull(game.deletedAt), ...buildFilters(opts, game))),
    ]);

    return {
      results: [...cards, ...others],
      meta: { total, limit, offset },
    };
  }

  /**
   * How many games release on each UTC day of a range (the release calendar's counts), with
   * the same filters as the list, and the covers of the day's most popular games. Days without
   * releases are left out; `total` is how many games release in the whole range.
   */
  static async releaseDays(opts: GameFilters) {
    const day = sql`to_char(to_timestamp(${game.firstReleaseDate}) at time zone 'UTC', 'YYYY-MM-DD')`;
    // Games with a cover first, so a day with any cover shows it
    const order = [sql`${cover.hash} is null`, ...orderFor(GameSort.Popular)(game)];
    const rows = await db.execute<{
      date: string;
      count: number;
      covers: { hash: string; source: string }[] | null;
    }>(sql`
      with ranked as (
        select ${day} as date, ${cover.hash} as hash, ${cover.source} as source,
          row_number() over (partition by ${day} order by ${sql.join(order, sql`, `)}) as rank
        from ${game}
        left join ${cover} on ${cover.gameId} = ${game.id}
        where ${and(isNull(game.deletedAt), sql`${game.firstReleaseDate} is not null`, ...buildFilters(opts, game))}
      )
      select date, count(*)::int as count,
        json_agg(json_build_object('hash', hash, 'source', source) order by rank)
          filter (where rank <= ${RELEASE_DAY_COVERS} and hash is not null) as covers
      from ranked
      group by date
      order by date
    `);
    const days = rows.rows.map((r) => ({
      date: r.date,
      count: Number(r.count),
      covers: (r.covers ?? []).map((c) => getImageUrl(c.source, c.hash, IgdbImageSize.COVER_BIG)),
    }));
    // Every matching game falls on exactly one day, so the range's total is the days' sum
    return { days, total: days.reduce((sum, d) => sum + d.count, 0) };
  }

  /**
   * Every UTC day from `from` (a day's start, Unix seconds) for `days` days, including the
   * empty ones: how many games release on it and the cards of its `perDay` most popular,
   * games with a cover first. One query ranks the range, a second loads the cards.
   */
  static async releasesByDay(from: number, days: number, perDay: number) {
    const day = sql`to_char(to_timestamp(${game.firstReleaseDate}) at time zone 'UTC', 'YYYY-MM-DD')`;
    const order = [sql`${cover.hash} is null`, ...orderFor(GameSort.Popular)(game)];
    const rows = await db.execute<{ date: string; count: number; ids: number[] | null }>(sql`
      with ranked as (
        select ${day} as date, ${game.id} as id,
          row_number() over (partition by ${day} order by ${sql.join(order, sql`, `)}) as rank
        from ${game}
        left join ${cover} on ${cover.gameId} = ${game.id}
        where ${isNull(game.deletedAt)}
          and ${game.firstReleaseDate} between ${from} and ${from + days * DAY_SECONDS - 1}
      )
      select date, count(*)::int as count,
        array_agg(id order by rank) filter (where rank <= ${perDay}) as ids
      from ranked
      group by date
    `);
    const byDate = new Map(rows.rows.map((r) => [r.date, r]));
    const cards = await GameService.findCards(rows.rows.flatMap((r) => (r.ids ?? []).map(Number)));
    const byId = new Map(cards.map((card) => [card.id, card]));
    return Array.from({ length: days }, (_, i) => {
      const date = new Date((from + i * DAY_SECONDS) * 1000).toISOString().slice(0, 10);
      const row = byDate.get(date);
      return {
        date,
        count: Number(row?.count ?? 0),
        games: (row?.ids ?? []).flatMap((id) => byId.get(Number(id)) ?? []),
      };
    });
  }

  /** Cards for a set of ids, in the order given (library imports, lists, similar games) */
  static async findCards(ids: number[]) {
    if (ids.length === 0) return [];
    const rows = await db.query.game.findMany({
      where: { id: { in: ids } },
      columns: GAME_CARD_COLUMNS,
      with: GAME_CARD_WITH,
    });
    const byId = new Map(rows.map((g) => [g.id, transformGameResponse(g)]));
    return ids.flatMap((id) => {
      const g = byId.get(id);
      return g ? [g] : [];
    });
  }

  /** The members' numbers for one game, as the detail view shows them */
  static community(gameId: number) {
    return communityStats(gameId);
  }

  /** Like a game; answers with the game's like count after the write */
  static async like(userId: string, gameId: number) {
    const exists = await db.query.game.findFirst({ where: { id: gameId }, columns: { id: true } });
    if (!exists) throw new NotFoundError("Game not found");
    const likes = await db.transaction(async (tx) => {
      await tx.insert(gameLike).values({ userId, gameId }).onConflictDoNothing();
      return likeCount(tx, gameId);
    });
    return { liked: true, likes };
  }

  static async unlike(userId: string, gameId: number) {
    const likes = await db.transaction(async (tx) => {
      await tx
        .delete(gameLike)
        .where(and(eq(gameLike.userId, userId), eq(gameLike.gameId, gameId)));
      return likeCount(tx, gameId);
    });
    return { liked: false, likes };
  }

  /** Games a user liked, newest first */
  static async likedBy(userId: string, opts: { limit: number; offset: number }) {
    const [rows, [{ total }]] = await Promise.all([
      db.query.gameLike.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        limit: opts.limit,
        offset: opts.offset,
        with: { game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH } },
      }),
      db.select({ total: count() }).from(gameLike).where(eq(gameLike.userId, userId)),
    ]);
    return {
      results: rows.map((row) => ({ ...transformGameResponse(row.game), likedAt: row.createdAt })),
      meta: { total, ...opts },
    };
  }
}
