import { and, count, desc, eq, exists, isNull, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { cover, game, gameToPlatform } from "@playdamnit/db/schema";
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

export const MAX_GAMES_PAGE_SIZE = 100;

export const GAME_SORTS = ["id", "popular", "recent"] as const;
export type GameSort = (typeof GAME_SORTS)[number];

// Live games that point at `id` through the given parent column (DLC → parent_game,
// editions → version_parent)
const findRelated = (column: "parentGameId" | "versionParentId", id: number) =>
  db.query.game.findMany({
    where: { [column]: id, deletedAt: { isNull: true } },
    orderBy: { firstReleaseDate: "asc" },
    columns: GAME_RELATED_COLUMNS,
    with: { cover: true },
  });

/**
 * Game service - handles all business logic for game operations
 */
export abstract class GameService {
  /**
   * Find a single game by ID. Deleted games are still served (libraries reference them) with
   * `deleted: true`.
   */
  static async findById(gameId: number) {
    const result = await db.query.game.findFirst({
      where: { id: gameId },
      columns: GAME_DETAIL_COLUMNS,
      with: GAME_DETAIL_WITH,
    });

    if (!result) {
      throw new NotFoundError("Game not found");
    }

    const [children, editions] = await Promise.all([
      findRelated("parentGameId", gameId),
      findRelated("versionParentId", gameId),
    ]);

    return transformGameDetail(result, { children, editions });
  }

  /**
   * Find games with pagination and optional platform filter. Deleted games are excluded.
   * `popular` orders by IGDB rating count, `recent` lists released games newest first
   * (unreleased and undated games are left out), `id` is the catalog order.
   */
  static async findGames(opts: {
    limit?: number;
    offset?: number;
    platformId?: number;
    sort?: GameSort;
  }) {
    const limit = Math.min(opts.limit ?? MAX_GAMES_PAGE_SIZE, MAX_GAMES_PAGE_SIZE);
    const offset = opts.offset ?? 0;
    const sort = opts.sort ?? "id";
    // Released games with a cover: new releases without artwork are noise on a front page.
    // RQB aliases the table inside `where`, so the filter is built from the table it passes.
    const released = (t: { id: unknown; firstReleaseDate: unknown }) =>
      sql`${t.firstReleaseDate} <= extract(epoch from now())::bigint and exists (select 1 from ${cover} where ${cover.gameId} = ${t.id})`;
    const releasedFilter = sort === "recent" ? released(game) : undefined;

    const platformFilter = opts.platformId
      ? exists(
          db
            .select({ one: sql`1` })
            .from(gameToPlatform)
            .where(
              and(
                eq(gameToPlatform.gameId, game.id),
                eq(gameToPlatform.platformId, opts.platformId),
              ),
            ),
        )
      : undefined;

    const [games, [{ total }]] = await Promise.all([
      db.query.game.findMany({
        limit,
        offset,
        where: {
          deletedAt: { isNull: true },
          ...(opts.platformId && { platforms: { id: opts.platformId } }),
          ...(sort === "recent" && { RAW: released }),
        },
        orderBy:
          sort === "popular"
            ? (t) => [desc(t.isPopular), sql`${t.totalRatingCount} desc nulls last`, t.id]
            : sort === "recent"
              ? (t) => [desc(t.firstReleaseDate), sql`${t.totalRatingCount} desc nulls last`]
              : { id: "asc" },
        columns: GAME_CARD_COLUMNS,
        with: GAME_CARD_WITH,
      }),
      db
        .select({ total: count() })
        .from(game)
        .where(and(isNull(game.deletedAt), platformFilter, releasedFilter)),
    ]);

    return {
      results: games.map(transformGameResponse),
      meta: { total, limit, offset },
    };
  }
}
