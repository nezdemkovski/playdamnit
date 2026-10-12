import { and, count, eq, inArray, sql } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import { platform, playthrough, userGames } from "@playdamnit/db/schema";
import { PgErrorCode, UserGameSource, UserGameStatus } from "@playdamnit/db/enums";
import { ensureGamesInCatalog } from "@/utils/catalogRequests";
import { GAME_CARD_COLUMNS, GAME_CARD_WITH, transformGameResponse } from "@/utils/gameTransformers";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/utils/errors";
import { canSeeList, requireUser } from "@/utils/social";
import { ENDED_STATUSES, MAX_REVIEW_LENGTH } from "./model";

const MAX_IMPORT_GAMES = 1000;
const IMPORT_FETCH_TIMEOUT_MS = 30_000;
const INSERT_CHUNK_SIZE = 500;

interface UserGameInput {
  status: UserGameStatus;
  rating?: number | null;
  review?: string | null;
  platformId?: number | null;
  endedAt?: string | null;
  mastered?: boolean;
  spoilers?: boolean;
  allowReactions?: boolean;
}

export interface PlaythroughInput {
  startedAt?: string | null;
  endedAt?: string | null;
  hours?: number | null;
  platformId?: number | null;
  note?: string | null;
}

const parseDay = (value: string | null | undefined, label: string): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value).getTime())) {
    throw new BadRequestError(`${label} must be a YYYY-MM-DD date`);
  }
  return value;
};

export interface ImportGameInput {
  gameId?: unknown;
  status?: unknown;
  rating?: unknown;
  review?: unknown;
  platformId?: unknown;
  endedAt?: unknown;
}

type LibraryOwner = { id: string; username?: string | null };

const parseEndedAt = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError("Invalid date format for endedAt");
  }
  if (date > new Date()) {
    throw new BadRequestError("Finished date cannot be in the future");
  }
  return date;
};

const assertPlatformExists = async (platformId: number | null | undefined) => {
  if (platformId === null || platformId === undefined) return;
  const found = await postgresDb.query.platform.findFirst({
    where: { id: platformId },
    columns: { id: true },
  });
  if (!found) {
    throw new BadRequestError(`Unknown platform: ${platformId}`);
  }
};

const isUniqueViolation = (error: unknown): boolean => {
  const code = (error as { code?: unknown })?.code;
  if (code === PgErrorCode.UniqueViolation) return true;
  const cause = (error as { cause?: unknown })?.cause;
  return cause !== undefined && cause !== error && isUniqueViolation(cause);
};

/**
 * UserGame service - handles all business logic for user game library operations
 */
export abstract class UserGameService {
  /**
   * Only the owner may modify a library; the username in the URL must match the session user
   */
  static assertOwnLibrary(username: string, user: LibraryOwner) {
    if (username !== user.username) {
      throw new ForbiddenError("You can only modify your own library");
    }
  }

  /**
   * Get games for a user by username. Without a limit the whole library is returned.
   */
  static async getUserGames(
    username: string,
    opts: { limit?: number; offset?: number; viewerId?: string | null } = {},
  ) {
    const userData = await requireUser(username);
    if (!canSeeList(userData, opts.viewerId ?? null)) {
      throw new ForbiddenError("This list is private");
    }

    const where = eq(userGames.userId, userData.id);

    const [entries, [{ total }]] = await Promise.all([
      postgresDb.query.userGames.findMany({
        where: { userId: userData.id },
        orderBy: { addedAt: "desc" },
        limit: opts.limit,
        offset: opts.offset,
        with: { game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH } },
      }),
      postgresDb.select({ total: count() }).from(userGames).where(where),
    ]);

    return {
      // Entries whose game the catalog hasn't fetched yet (pre-FK data) are skipped
      results: entries
        .filter((entry) => entry.game)
        .map((entry) => ({
          ...transformGameResponse(entry.game),
          userGameData: {
            id: entry.id,
            status: entry.status,
            rating: entry.rating !== null ? Number(entry.rating) : null,
            review: entry.review,
            platformId: entry.platformId,
            addedAt: entry.addedAt,
            endedAt: entry.endedAt,
            source: entry.source,
            mastered: entry.mastered,
            spoilers: entry.spoilers,
            allowReactions: entry.allowReactions,
            steamMinutes: entry.steamMinutes,
            steamLastPlayedAt: entry.steamLastPlayedAt,
            updatedAt: entry.updatedAt,
          },
        })),
      meta: { total, limit: opts.limit, offset: opts.offset ?? 0 },
    };
  }

  /**
   * Add a game to the user's library, fetching it from IGDB if the catalog lacks it
   */
  static async addUserGame(userId: string, gameId: number, input: UserGameInput) {
    const { available } = await ensureGamesInCatalog([gameId]);
    if (!available.has(gameId)) {
      throw new NotFoundError("Game not found");
    }

    await assertPlatformExists(input.platformId);

    try {
      const [inserted] = await postgresDb
        .insert(userGames)
        .values({
          userId,
          gameId,
          status: input.status,
          rating: input.rating?.toString() ?? null,
          review: input.review ?? null,
          mastered: input.mastered ?? false,
          spoilers: input.spoilers ?? false,
          allowReactions: input.allowReactions ?? true,
          endedAt: parseEndedAt(input.endedAt) ?? null,
          platformId: input.platformId ?? null,
          source: UserGameSource.Manual,
        })
        .onConflictDoNothing({ target: [userGames.userId, userGames.gameId] })
        .returning();

      if (!inserted) {
        throw new ConflictError("Game already exists in library");
      }

      return {
        message: "Game added successfully",
        game: { ...inserted, rating: inserted.rating !== null ? Number(inserted.rating) : null },
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Game already exists in library");
      }
      throw error;
    }
  }

  /**
   * Update a library entry
   */
  static async updateUserGame(userId: string, gameId: number, input: Partial<UserGameInput>) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestError("At least one field must be provided");
    }

    await assertPlatformExists(input.platformId);

    const endedAt = parseEndedAt(input.endedAt);

    const [updated] = await postgresDb
      .update(userGames)
      .set({
        ...(input.status !== undefined && { status: input.status }),
        ...(input.rating !== undefined && { rating: input.rating?.toString() ?? null }),
        ...(input.review !== undefined && { review: input.review }),
        ...(input.mastered !== undefined && { mastered: input.mastered }),
        ...(input.spoilers !== undefined && { spoilers: input.spoilers }),
        ...(input.allowReactions !== undefined && { allowReactions: input.allowReactions }),
        ...(input.platformId !== undefined && { platformId: input.platformId }),
        ...(endedAt !== undefined && { endedAt }),
      })
      .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
      .returning();

    if (!updated) {
      throw new NotFoundError("Game not found in user's library");
    }

    return {
      message: "Game updated successfully",
      game: { ...updated, rating: updated.rating !== null ? Number(updated.rating) : null },
    };
  }

  /**
   * Delete a game from user's library
   */
  static async deleteUserGame(userId: string, gameId: number) {
    const [deletedGame] = await postgresDb
      .delete(userGames)
      .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
      .returning({ gameId: userGames.gameId });

    if (!deletedGame) {
      throw new NotFoundError("Game not found in user's library");
    }

    return {
      message: "Removed successfully",
      id: deletedGame.gameId,
    };
  }

  // ─── Playthroughs (the journal) ───────────────────────────────────────────

  private static async requireEntry(userId: string, gameId: number) {
    const entry = await postgresDb.query.userGames.findFirst({
      where: { userId, gameId },
      columns: { id: true },
    });
    if (!entry) throw new NotFoundError("Game not found in user's library");
    return entry;
  }

  static async listPlaythroughs(username: string, gameId: number, viewerId: string | null) {
    const owner = await requireUser(username);
    if (!canSeeList(owner, viewerId)) throw new ForbiddenError("This list is private");
    const rows = await postgresDb.query.playthrough.findMany({
      where: { userId: owner.id, gameId },
      orderBy: { createdAt: "desc" },
      with: { platform: true },
    });
    return rows.map((row) => ({ ...row, hours: row.hours !== null ? Number(row.hours) : null }));
  }

  static async addPlaythrough(userId: string, gameId: number, input: PlaythroughInput) {
    await UserGameService.requireEntry(userId, gameId);
    await assertPlatformExists(input.platformId);
    const [row] = await postgresDb
      .insert(playthrough)
      .values({
        userId,
        gameId,
        startedAt: parseDay(input.startedAt, "Start date") ?? null,
        endedAt: parseDay(input.endedAt, "End date") ?? null,
        hours: input.hours !== null && input.hours !== undefined ? input.hours.toString() : null,
        platformId: input.platformId ?? null,
        note: input.note?.trim() || null,
      })
      .returning();
    return { ...row, hours: row.hours !== null ? Number(row.hours) : null };
  }

  static async updatePlaythrough(userId: string, id: string, input: PlaythroughInput) {
    await assertPlatformExists(input.platformId);
    const startedAt = parseDay(input.startedAt, "Start date");
    const endedAt = parseDay(input.endedAt, "End date");
    const [row] = await postgresDb
      .update(playthrough)
      .set({
        ...(startedAt !== undefined && { startedAt }),
        ...(endedAt !== undefined && { endedAt }),
        ...(input.hours !== undefined && { hours: input.hours?.toString() ?? null }),
        ...(input.platformId !== undefined && { platformId: input.platformId }),
        ...(input.note !== undefined && { note: input.note?.trim() || null }),
      })
      .where(and(eq(playthrough.id, id), eq(playthrough.userId, userId)))
      .returning();
    if (!row) throw new NotFoundError("Playthrough not found");
    return { ...row, hours: row.hours !== null ? Number(row.hours) : null };
  }

  static async deletePlaythrough(userId: string, id: string) {
    const [row] = await postgresDb
      .delete(playthrough)
      .where(and(eq(playthrough.id, id), eq(playthrough.userId, userId)))
      .returning({ id: playthrough.id });
    if (!row) throw new NotFoundError("Playthrough not found");
    return { message: "Removed successfully", id: row.id };
  }

  /**
   * Validate and normalise one import row. Returns an error message for invalid rows.
   */
  static normalizeImportRow(
    raw: ImportGameInput,
  ):
    | { ok: true; gameId: number; value: UserGameInput }
    | { ok: false; gameId: number; error: string } {
    const gameId = Number(raw.gameId);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return { ok: false, gameId: 0, error: "Invalid or missing gameId" };
    }

    const status = String(raw.status ?? "");
    if (!Object.values<string>(UserGameStatus).includes(status)) {
      return { ok: false, gameId, error: "Invalid or missing status" };
    }

    let rating: number | null = null;
    if (raw.rating !== null && raw.rating !== undefined && raw.rating !== "") {
      rating = Number(raw.rating);
      if (Number.isNaN(rating) || rating < 0 || rating > 10) {
        return { ok: false, gameId, error: "Rating must be between 0 and 10" };
      }
    }

    // Exports used 0 for "no platform"
    let platformId: number | null = null;
    if (raw.platformId !== null && raw.platformId !== undefined && raw.platformId !== "") {
      platformId = Number(raw.platformId);
      if (!Number.isInteger(platformId) || platformId < 0) {
        return { ok: false, gameId, error: "Invalid platformId" };
      }
      if (platformId === 0) platformId = null;
    }

    let review: string | null = null;
    if (raw.review !== null && raw.review !== undefined && raw.review !== "") {
      // Undo the formula-escaping quote added by the CSV export
      review = String(raw.review).replace(/^'(?=[=+\-@\t\r])/, "");
      if (review.length > MAX_REVIEW_LENGTH) {
        return {
          ok: false,
          gameId,
          error: `Review must be at most ${MAX_REVIEW_LENGTH} characters`,
        };
      }
    }

    const endedAt =
      raw.endedAt === null || raw.endedAt === undefined || raw.endedAt === ""
        ? null
        : String(raw.endedAt);

    if (endedAt && !ENDED_STATUSES.includes(status)) {
      return {
        ok: false,
        gameId,
        error: "endedAt can only be set for games with status 'finished' or 'dropped'",
      };
    }

    try {
      parseEndedAt(endedAt);
    } catch (error) {
      return { ok: false, gameId, error: (error as Error).message };
    }

    return {
      ok: true,
      gameId,
      value: { status: status as UserGameStatus, rating, review, platformId, endedAt },
    };
  }

  /**
   * Bulk import into the user's library. Missing games are fetched from IGDB in one job,
   * everything is written in a single transaction.
   */
  static async importUserGames(
    userId: string,
    rows: ImportGameInput[],
    overwriteExisting: boolean,
    options: { source?: UserGameSource; maxGames?: number } = {},
  ) {
    const maxGames = options.maxGames ?? MAX_IMPORT_GAMES;
    if (rows.length === 0) {
      throw new BadRequestError("No games provided for import");
    }
    if (rows.length > maxGames) {
      throw new BadRequestError(
        `Too many games to import. Maximum allowed: ${maxGames}, provided: ${rows.length}`,
      );
    }

    const errorGames: { gameId: number; error: string }[] = [];
    const skippedGames: { gameId: number; reason: string }[] = [];

    // Validate; a later row for the same game wins
    const valid = new Map<number, UserGameInput>();
    for (const raw of rows) {
      const result = UserGameService.normalizeImportRow(raw);
      if (result.ok) {
        valid.set(result.gameId, result.value);
      } else {
        errorGames.push({ gameId: result.gameId, error: result.error });
      }
    }

    const { available, fetched } = await ensureGamesInCatalog(
      [...valid.keys()],
      IMPORT_FETCH_TIMEOUT_MS,
    );

    // Platform ids are catalog ids; drop the ones this catalog doesn't know
    const platformIds = [
      ...new Set([...valid.values()].map((v) => v.platformId).filter((id): id is number => !!id)),
    ];
    const knownPlatforms = new Set(
      platformIds.length
        ? (
            await postgresDb
              .select({ id: platform.id })
              .from(platform)
              .where(inArray(platform.id, platformIds))
          ).map((row) => row.id)
        : [],
    );

    const toWrite: (typeof userGames.$inferInsert)[] = [];
    for (const [gameId, value] of valid) {
      if (!available.has(gameId)) {
        errorGames.push({
          gameId,
          error: "Game not found in database and could not be fetched from IGDB",
        });
        continue;
      }
      if (value.platformId && !knownPlatforms.has(value.platformId)) {
        errorGames.push({ gameId, error: `Unknown platform: ${value.platformId}` });
        continue;
      }

      toWrite.push({
        userId,
        gameId,
        status: value.status,
        rating: value.rating?.toString() ?? null,
        review: value.review ?? null,
        platformId: value.platformId ?? null,
        endedAt: parseEndedAt(value.endedAt) ?? null,
        source: options.source ?? UserGameSource.Manual,
      });
    }

    const importedGames: number[] = [];

    await postgresDb.transaction(async (tx) => {
      for (let i = 0; i < toWrite.length; i += INSERT_CHUNK_SIZE) {
        const chunk = toWrite.slice(i, i + INSERT_CHUNK_SIZE);
        const insert = tx.insert(userGames).values(chunk);

        const written = await (
          overwriteExisting
            ? insert.onConflictDoUpdate({
                target: [userGames.userId, userGames.gameId],
                set: {
                  status: sql`excluded.status`,
                  rating: sql`excluded.rating`,
                  review: sql`excluded.review`,
                  platformId: sql`excluded.platform_id`,
                  endedAt: sql`excluded.ended_at`,
                },
              })
            : insert.onConflictDoNothing({ target: [userGames.userId, userGames.gameId] })
        ).returning({ gameId: userGames.gameId });

        const writtenIds = new Set(written.map((row) => row.gameId));
        for (const row of chunk) {
          if (writtenIds.has(row.gameId)) {
            importedGames.push(row.gameId);
          } else {
            skippedGames.push({ gameId: row.gameId, reason: "Game already exists in library" });
          }
        }
      }
    });

    return {
      message: `Import completed: ${importedGames.length} imported, ${skippedGames.length} skipped, ${errorGames.length} errors, ${fetched.length} fetched from IGDB`,
      imported: importedGames.length,
      skipped: skippedGames.length,
      errors: errorGames.length,
      fetchedFromIGDB: fetched.length,
      details: {
        importedGames,
        skippedGames,
        errorGames,
        fetchedFromIGDBGames: fetched,
      },
    };
  }

  /**
   * Export rows for the user's library
   */
  static async exportUserGames(userId: string) {
    const entries = await postgresDb.query.userGames.findMany({
      where: { userId },
      orderBy: { addedAt: "desc" },
      with: { game: { columns: { name: true } } },
    });

    return entries.map((entry) => ({
      gameId: entry.gameId,
      gameName: entry.game?.name ?? null,
      status: entry.status,
      rating: entry.rating !== null ? Number(entry.rating) : null,
      review: entry.review,
      platformId: entry.platformId,
      addedAt: entry.addedAt.toISOString(),
      endedAt: ENDED_STATUSES.includes(entry.status)
        ? (entry.endedAt?.toISOString() ?? null)
        : null,
      source: entry.source,
    }));
  }
}
