import { and, count, eq, exists, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { game, gameToPlatform } from "@playdamnit/db/schema";
import {
  GAME_CARD_COLUMNS,
  GAME_CARD_WITH,
  GAME_DETAIL_COLUMNS,
  GAME_DETAIL_WITH,
  transformGameResponse,
} from "@/utils/gameTransformers";
import { NotFoundError } from "@/utils/errors";

export const MAX_GAMES_PAGE_SIZE = 100;

/**
 * Game service - handles all business logic for game operations
 */
export abstract class GameService {
  /**
   * Find a single game by ID
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

    return transformGameResponse(result);
  }

  /**
   * Find games with pagination and optional platform filter
   */
  static async findGames(opts: { limit?: number; offset?: number; platformId?: number }) {
    const limit = Math.min(opts.limit ?? MAX_GAMES_PAGE_SIZE, MAX_GAMES_PAGE_SIZE);
    const offset = opts.offset ?? 0;

    const countWhere = opts.platformId
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
        where: opts.platformId ? { platforms: { id: opts.platformId } } : undefined,
        orderBy: { id: "asc" },
        columns: GAME_CARD_COLUMNS,
        with: GAME_CARD_WITH,
      }),
      db.select({ total: count() }).from(game).where(countWhere),
    ]);

    return {
      results: games.map(transformGameResponse),
      meta: { total, limit, offset },
    };
  }
}
