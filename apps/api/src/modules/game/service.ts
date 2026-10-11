import { and, count, eq, isNull, sql, type SQL } from "drizzle-orm";

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

export const MAX_GAMES_PAGE_SIZE = 100;
const SIMILAR_GAMES_LIMIT = 12;
// "Best" needs enough IGDB votes to mean anything
const MIN_RATINGS_FOR_BEST = 50;

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
};

const yearBounds = (year: number) => ({
  from: Math.floor(Date.UTC(year, 0, 1) / 1000),
  to: Math.floor(Date.UTC(year + 1, 0, 1) / 1000) - 1,
});

const hasCover = (t: GameRef) =>
  sql`exists (select 1 from ${cover} where ${cover.gameId} = ${t.id})`;

const libraryCount = (t: GameRef, statuses?: readonly UserGameStatus[]) =>
  statuses
    ? sql<number>`(select count(*) from ${userGames} where ${userGames.gameId} = ${t.id} and ${userGames.status} in ${statuses})`
    : sql<number>`(select count(*) from ${userGames} where ${userGames.gameId} = ${t.id})`;

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
      return [sql`${t.isPopular} desc`, popularity, sql`${t.id}`];
    case GameSort.Rating:
      return [sql`${t.totalRating} desc nulls last`, popularity];
    case GameSort.Recent:
      return [sql`${t.firstReleaseDate} desc`, popularity];
    case GameSort.Upcoming:
    case GameSort.Date:
      return [sql`${t.firstReleaseDate} asc`, popularity];
    case GameSort.Wanted:
      return [
        sql`${libraryCount(t, [UserGameStatus.WantToPlay, UserGameStatus.Backlog])} desc`,
        popularity,
      ];
    case GameSort.Played:
      return [sql`${libraryCount(t)} desc`, popularity];
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

/** What this site's members did with the game: status counts, ratings, likes, lists */
const communityStats = async (gameId: number) => {
  const [statusRows, [ratings], [likes], [lists], histogramRows] = await Promise.all([
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
    db.select({ n: count() }).from(gameLike).where(eq(gameLike.gameId, gameId)),
    db
      .select({ n: count() })
      .from(gameListItem)
      .innerJoin(gameList, eq(gameList.id, gameListItem.listId))
      .where(and(eq(gameListItem.gameId, gameId), eq(gameList.isPublic, true))),
    db
      .select({
        bucket: sql<number>`least(10, greatest(1, ceil(${userGames.rating})))::int`,
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
  for (const row of histogramRows) histogram[Number(row.bucket) - 1] = Number(row.n);

  const [reviewCount] = await db
    .select({ n: count() })
    .from(userGames)
    .where(and(eq(userGames.gameId, gameId), sql`${userGames.review} is not null`));

  return {
    total,
    statuses,
    mastered,
    ratingAverage: ratings.avg ? Math.round(Number(ratings.avg) * 10) / 10 : null,
    ratingCount: Number(ratings.n),
    histogram,
    reviews: Number(reviewCount.n),
    likes: Number(likes.n),
    lists: Number(lists.n),
  };
};

/**
 * Game service - handles all business logic for game operations
 */
export abstract class GameService {
  /**
   * Find a single game by ID. Deleted games are still served (libraries reference them) with
   * `deleted: true`. `viewerId` adds the viewer's like state.
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
    const [children, editions, similar, community, liked] = await Promise.all([
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
      viewer: { liked: !!liked },
    };
  }

  /**
   * Browse the catalog: filters by platform, genre, year/date range, type and ids; sorts by
   * IGDB popularity or rating, release date (recent/upcoming) or this site's members
   * (wanted/played). Deleted games are excluded.
   */
  static async findGames(opts: GameFilters) {
    const limit = Math.min(opts.limit ?? MAX_GAMES_PAGE_SIZE, MAX_GAMES_PAGE_SIZE);
    const offset = opts.offset ?? 0;
    const sort = opts.sort ?? GameSort.Id;

    const [games, [{ total }]] = await Promise.all([
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
      db
        .select({ total: count() })
        .from(game)
        .where(and(isNull(game.deletedAt), ...buildFilters(opts, game))),
    ]);

    return {
      results: games.map(transformGameResponse),
      meta: { total, limit, offset },
    };
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

  static async like(userId: string, gameId: number) {
    const exists = await db.query.game.findFirst({ where: { id: gameId }, columns: { id: true } });
    if (!exists) throw new NotFoundError("Game not found");
    await db.insert(gameLike).values({ userId, gameId }).onConflictDoNothing();
    return { liked: true };
  }

  static async unlike(userId: string, gameId: number) {
    await db.delete(gameLike).where(and(eq(gameLike.userId, userId), eq(gameLike.gameId, gameId)));
    return { liked: false };
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
