import { checkPublicText } from "@/modules/moderation/filter";
import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import {
  cover,
  game,
  gameToPlatform,
  LOCAL_PLATFORM_MIN_ID,
  platform,
  playthrough,
  userGames,
} from "@playdamnit/db/schema";
import { PgErrorCode, UserGameSource, UserGameStatus } from "@playdamnit/db/enums";
import { ensureGamesInCatalog } from "@/utils/catalogRequests";
import {
  coverUrl,
  GAME_CARD_COLUMNS,
  GAME_CARD_WITH,
  transformGameResponse,
} from "@/utils/gameTransformers";
import { type Grade, LibrarySort } from "@/utils/enums";
import { gradeOf, ratingOfGrade } from "@/utils/grade";
import { escapeLike } from "@/utils/searchGames";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/utils/errors";
import { canSeeList, requireUser } from "@/utils/social";
import { idleOf } from "./idle";
import { ENDED_STATUSES, MAX_REVIEW_LENGTH } from "./model";
import { canGrade } from "./rules";
import { todayIn } from "./completionDate";
import { GameService } from "@/modules/game/service";

const MAX_IMPORT_GAMES = 1000;
const IMPORT_FETCH_TIMEOUT_MS = 30_000;
const INSERT_CHUNK_SIZE = 500;
const OVERVIEW_RAIL = 12;
/** Enough covers for the widest window; clients repeat them to fill a narrower one */
const OVERVIEW_SHELF = 20;
/** The lowest rating that reads as an S */
const S_GRADE_MIN = 9;

interface UserGameInput {
  status: UserGameStatus;
  rating?: number | null;
  /** A picked grade, stored as its band's middle; instead of `rating` */
  grade?: Grade | null;
  review?: string | null;
  platformId?: number | null;
  endedAt?: string | null;
  mastered?: boolean;
  spoilers?: boolean;
  allowReactions?: boolean;
  playthroughs?: PlaythroughInput[];
  timeZone?: string;
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

const parseEndedAt = (
  value: string | null | undefined,
  timeZone?: string,
): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError("Invalid date format for endedAt");
  }
  if (timeZone ? date.toISOString().slice(0, 10) > todayIn(timeZone) : date > new Date()) {
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

/** The rating a write stores: a picked grade becomes its band's middle; undefined leaves it */
const resolveRating = (input: Partial<UserGameInput>): number | null | undefined => {
  if (input.grade !== undefined) {
    if (input.rating !== undefined) throw new BadRequestError("Send a rating or a grade, not both");
    return ratingOfGrade(input.grade);
  }
  return input.rating;
};

type EntryRow = typeof userGames.$inferSelect & {
  game: Parameters<typeof transformGameResponse>[0] | null;
};

/** A library row as the list serves it: the game's card with the member's entry on it */
const toLibraryEntry = (entry: EntryRow & { game: NonNullable<EntryRow["game"]> }) => ({
  ...transformGameResponse(entry.game),
  userGameData: {
    id: entry.id,
    status: entry.status,
    rating: entry.rating !== null ? Number(entry.rating) : null,
    grade: gradeOf(entry.rating),
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
    idle: idleOf(entry),
  },
});

const INDEX_GAME_WITH = {
  game: { columns: { id: true, name: true, firstReleaseDate: true }, with: { cover: true } },
} as const;

type IndexRow = Omit<typeof userGames.$inferSelect, "review" | "userId" | "gameId"> & {
  hasReview: boolean;
  game: {
    id: number;
    name: string;
    firstReleaseDate: number | null;
    cover: Parameters<typeof coverUrl>[0];
  } | null;
};

/** A library row on the light index card: no review text, the game as id, name, date, cover */
const toIndexItems = (entries: IndexRow[]) =>
  entries.flatMap(({ game: g, hasReview, ...entry }) =>
    g
      ? [
          {
            id: g.id,
            name: g.name,
            firstReleaseDate: g.firstReleaseDate,
            cover: coverUrl(g.cover),
            userGameData: {
              id: entry.id,
              status: entry.status,
              rating: entry.rating !== null ? Number(entry.rating) : null,
              grade: gradeOf(entry.rating),
              hasReview,
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
              idle: idleOf(entry),
            },
          },
        ]
      : [],
  );

/** A rating counts as a grade above zero; zero is what clearing a grade writes */
const isGraded = (t: typeof userGames) => sql`coalesce(${t.rating}, 0) > 0`;

/** One member's entry for a game as the list serves it, or null when the game is not in it */
const libraryEntry = async (userId: string, gameId: number) => {
  const entry = await postgresDb.query.userGames.findFirst({
    where: { userId, gameId },
    with: { game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH } },
  });
  return entry?.game ? toLibraryEntry({ ...entry, game: entry.game }) : null;
};

// Untouched backlog first, then stale "playing", finished games last (the web's shame order)
const SHAME_RANK: Record<UserGameStatus, number> = {
  [UserGameStatus.Backlog]: 0,
  [UserGameStatus.WantToPlay]: 0,
  [UserGameStatus.OnHold]: 1,
  [UserGameStatus.Playing]: 2,
  [UserGameStatus.Online]: 3,
  [UserGameStatus.Dropped]: 4,
  [UserGameStatus.Finished]: 5,
};

/** A library's order for each sort, with the entry id last so pages never overlap */
const libraryOrder = (t: typeof userGames, sort: LibrarySort): SQL[] => {
  const gameColumn = (column: SQL) =>
    sql`(select ${column} from ${game} where ${game.id} = ${t.gameId})`;
  const keys: Record<LibrarySort, SQL[]> = {
    [LibrarySort.Shame]: [
      sql`case ${t.status} ${sql.join(
        Object.entries(SHAME_RANK).map(([status, rank]) => sql`when ${status} then ${rank}`),
        sql` `,
      )} end`,
      // Idle longest first: Steam's last launch when there is one, else the last edit
      sql`coalesce(${t.steamLastPlayedAt}, ${t.updatedAt}, ${t.addedAt}) asc`,
    ],
    [LibrarySort.Added]: [sql`${t.addedAt} desc`],
    [LibrarySort.Grade]: [sql`${t.rating} desc nulls last`],
    [LibrarySort.Hours]: [sql`${t.steamMinutes} desc nulls last`],
    [LibrarySort.Name]: [sql`${gameColumn(sql`${game.name}`)} asc`],
    [LibrarySort.Release]: [sql`${gameColumn(sql`${game.firstReleaseDate}`)} desc nulls last`],
  };
  return [...keys[sort], sql`${t.id}`];
};

/**
 * The rows of one page, picked by id before anything is joined: ordered and limited in the outer
 * query, Postgres builds the game card of every matching entry first and only then keeps a page
 * of them (a 600-game library paid 85ms for 50 rows). `where` and `order` use the plain table,
 * the outer query's alias never reaches the subquery.
 */
const pageOf = (
  t: typeof userGames,
  where: SQL,
  order: SQL[],
  page: { limit: number; offset: number },
) =>
  sql`${t.id} in (select ${userGames.id} from ${userGames} where ${where} order by ${sql.join(order, sql`, `)} limit ${page.limit} offset ${page.offset})`;

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
   * Get games for a user by username. Without a limit the whole library is returned. A status,
   * a search over the game's names and a sort narrow and order it, so a client can page through
   * a large library instead of loading all of it.
   */
  static async getUserGames(
    username: string,
    opts: {
      limit?: number;
      offset?: number;
      viewerId?: string | null;
      status?: UserGameStatus;
      q?: string;
      sort?: LibrarySort;
    } = {},
  ) {
    const userData = await requireUser(username, opts.viewerId ?? null);
    if (!canSeeList(userData, opts.viewerId ?? null)) {
      throw new ForbiddenError("This list is private");
    }

    const q = opts.q?.trim();
    const filters = (t: typeof userGames) =>
      [
        eq(t.userId, userData.id),
        opts.status ? eq(t.status, opts.status) : undefined,
        q
          ? sql`exists (select 1 from ${game} where ${game.id} = ${t.gameId} and coalesce(${game.searchNames}, ${game.name}) ilike ${`%${escapeLike(q)}%`})`
          : undefined,
      ].filter((f) => f !== undefined);

    const sort = opts.sort ?? LibrarySort.Added;
    const [entries, [{ total }]] = await Promise.all([
      postgresDb.query.userGames.findMany({
        where: {
          RAW: (t) =>
            opts.limit === undefined
              ? and(...filters(t))!
              : pageOf(t, and(...filters(userGames))!, libraryOrder(userGames, sort), {
                  limit: opts.limit,
                  offset: opts.offset ?? 0,
                }),
        },
        orderBy: (t) => libraryOrder(t, sort),
        with: { game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH } },
      }),
      postgresDb
        .select({ total: count() })
        .from(userGames)
        .where(and(...filters(userGames))),
    ]);

    return {
      // Entries whose game the catalog hasn't fetched yet (pre-FK data) are skipped
      results: entries.flatMap((entry) =>
        entry.game ? [toLibraryEntry({ ...entry, game: entry.game })] : [],
      ),
      meta: { total, limit: opts.limit, offset: opts.offset ?? 0 },
    };
  }

  /**
   * The whole library, light: each entry without its review text, and its game as the id, name,
   * release date and cover only. Enough for "is this mine, how did I grade it" and everything a
   * profile or the home page works out from a library (tiers, badges, the year, the verdict),
   * at a fraction of the full list's size.
   */
  static async getLibraryIndex(
    username: string,
    viewerId: string | null,
    opts: {
      /** Only graded entries (true) or only the ungraded (false): the grading deck's queue */
      graded?: boolean;
    } = {},
  ) {
    const userData = await requireUser(username, viewerId);
    if (!canSeeList(userData, viewerId)) {
      throw new ForbiddenError("This list is private");
    }
    const entries = await postgresDb.query.userGames.findMany({
      where: {
        RAW: (t) =>
          and(
            eq(t.userId, userData.id),
            opts.graded === undefined
              ? undefined
              : opts.graded
                ? isGraded(t)
                : sql`not ${isGraded(t)}`,
          )!,
      },
      orderBy: { addedAt: "desc" },
      columns: { review: false, userId: false, gameId: false },
      extras: { hasReview: (t) => sql<boolean>`${t.review} is not null` },
      with: INDEX_GAME_WITH,
    });
    return { results: toIndexItems(entries) };
  }

  /**
   * A profile's overview rails, each at most a dozen light cards: now playing, most played on
   * Steam, recently finished or dropped, and the cover shelf (best graded first, then the
   * ungraded by when they were added). A private list comes back empty with `private: true`.
   */
  static async getOverview(username: string, viewerId: string | null) {
    const owner = await requireUser(username, viewerId);
    if (!canSeeList(owner, viewerId)) {
      return {
        private: true,
        playing: [],
        mostPlayed: [],
        recent: [],
        shelf: [],
        hallOfFame: false,
      };
    }
    const rail = (
      where: (t: typeof userGames) => SQL,
      orderBy: (t: typeof userGames) => SQL[],
      limit = OVERVIEW_RAIL,
    ) =>
      postgresDb.query.userGames.findMany({
        where: { RAW: (t) => and(eq(t.userId, owner.id), where(t))! },
        orderBy: (t) => [...orderBy(t), sql`${t.id}`],
        limit,
        columns: { review: false, userId: false, gameId: false },
        extras: { hasReview: (t) => sql<boolean>`${t.review} is not null` },
        with: INDEX_GAME_WITH,
      });
    const [playing, mostPlayed, recent, shelf] = await Promise.all([
      rail(
        (t) => eq(t.status, UserGameStatus.Playing),
        (t) => [sql`${t.addedAt} desc`],
      ),
      rail(
        (t) => sql`${t.steamMinutes} > 0`,
        (t) => [sql`${t.steamMinutes} desc`],
      ),
      rail(
        (t) => sql`${t.endedAt} is not null`,
        (t) => [sql`${t.endedAt} desc`],
      ),
      rail(
        (t) => sql`exists (select 1 from ${cover} where ${cover.gameId} = ${t.gameId})`,
        (t) => [sql`coalesce(${t.rating}, 0) desc`, sql`${t.addedAt} desc`],
        OVERVIEW_SHELF,
      ),
    ]);
    const shelfItems = toIndexItems(shelf);
    return {
      private: false,
      playing: toIndexItems(playing),
      mostPlayed: toIndexItems(mostPlayed),
      recent: toIndexItems(recent),
      shelf: shelfItems,
      // The shelf is a hall of fame once it opens with an S
      hallOfFame: (shelfItems[0]?.userGameData.rating ?? 0) >= S_GRADE_MIN,
    };
  }

  /** One entry in full, review included, as the library list serves it */
  static async getEntry(username: string, gameId: number, viewerId: string | null) {
    const userData = await requireUser(username, viewerId);
    if (!canSeeList(userData, viewerId)) {
      throw new ForbiddenError("This list is private");
    }
    const entry = await libraryEntry(userData.id, gameId);
    if (!entry) throw new NotFoundError("Game not found in user's library");
    return entry;
  }

  /**
   * The platform a new entry goes on when the client sends none: the one the member logs most
   * games on among the game's platforms (and the local ones, Steam Deck and the like, which IGDB
   * does not list), else the game's first platform; null for a game on no platform
   */
  static async defaultPlatform(userId: string, gameId: number): Promise<number | null> {
    const result = await postgresDb.execute<{ id: number }>(sql`
      with mine as (
        select ${userGames.platformId} as id, count(*) as n
        from ${userGames}
        where ${userGames.userId} = ${userId} and ${userGames.platformId} is not null
        group by ${userGames.platformId}
      ),
      candidates as (
        select ${gameToPlatform.platformId} as id from ${gameToPlatform}
        where ${gameToPlatform.gameId} = ${gameId}
        union
        select ${platform.id} from ${platform} where ${platform.id} >= ${LOCAL_PLATFORM_MIN_ID}
      )
      select candidates.id
      from candidates left join mine on mine.id = candidates.id
      -- a local platform only when the member uses it
      where mine.n is not null or candidates.id < ${LOCAL_PLATFORM_MIN_ID}
      order by mine.n desc nulls last, candidates.id
      limit 1
    `);
    return result.rows[0]?.id ?? null;
  }

  /**
   * Add a game to the user's library, fetching it from IGDB if the catalog lacks it. Without a
   * platformId the server picks one (`defaultPlatform`); an explicit null keeps it empty.
   */
  static async addUserGame(userId: string, gameId: number, input: UserGameInput) {
    checkPublicText(input.review);
    const { available } = await ensureGamesInCatalog([gameId]);
    if (!available.has(gameId)) {
      throw new NotFoundError("Game not found");
    }

    await assertPlatformExists(input.platformId);
    const platformId =
      input.platformId === undefined
        ? await UserGameService.defaultPlatform(userId, gameId)
        : input.platformId;
    const requestedRating = resolveRating(input);
    const rating = canGrade(input.status) ? requestedRating : null;
    const today = input.timeZone ? todayIn(input.timeZone) : undefined;
    const endedAt = ENDED_STATUSES.includes(input.status)
      ? parseEndedAt(input.endedAt === undefined ? today : input.endedAt, input.timeZone)
      : null;

    const runs = input.playthroughs ?? [];
    for (const run of runs) await assertPlatformExists(run.platformId);
    const preparedRuns = runs.map((run) => ({
      userId,
      gameId,
      startedAt: parseDay(run.startedAt, "Start date") ?? null,
      endedAt: parseDay(run.endedAt, "End date") ?? null,
      hours: run.hours?.toString() ?? null,
      platformId: run.platformId ?? null,
      note: run.note?.trim() || null,
    }));
    try {
      const inserted = await postgresDb.transaction(async (tx) => {
        const [created] = await tx
          .insert(userGames)
          .values({
            userId,
            gameId,
            status: input.status,
            rating: rating?.toString() ?? null,
            review: input.review ?? null,
            mastered: input.mastered ?? false,
            spoilers: input.spoilers ?? false,
            allowReactions: input.allowReactions ?? true,
            endedAt: endedAt ?? null,
            platformId,
            source: UserGameSource.Manual,
          })
          .onConflictDoNothing({ target: [userGames.userId, userGames.gameId] })
          .returning();

        if (!created) throw new ConflictError("Game already exists in library");
        const completionDay = created.endedAt?.toISOString().slice(0, 10) ?? null;
        // Historical runs are additional completions, not replacements for the selected
        // finish date. A manual run on that date/platform already represents this finish.
        const includesCompletion = preparedRuns.some(
          (run) => run.endedAt === completionDay && run.platformId === created.platformId,
        );
        if (
          created.status === UserGameStatus.Finished &&
          (preparedRuns.length === 0 || completionDay !== null) &&
          !includesCompletion
        ) {
          preparedRuns.push({
            userId,
            gameId,
            startedAt: null,
            endedAt: completionDay,
            hours: null,
            platformId: created.platformId,
            note: null,
          });
        }
        if (preparedRuns.length) await tx.insert(playthrough).values(preparedRuns);
        return created;
      });

      // The entry as the list serves it and the game's new member numbers, so clients update
      // what they hold instead of loading the library and the game again
      const [entry, community] = await Promise.all([
        libraryEntry(userId, gameId),
        GameService.community(gameId),
      ]);
      return {
        message: "Game added successfully",
        game: {
          ...inserted,
          rating: inserted.rating !== null ? Number(inserted.rating) : null,
          grade: gradeOf(inserted.rating),
        },
        entry,
        community,
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
    checkPublicText(input.review);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError("At least one field must be provided");
    }

    await assertPlatformExists(input.platformId);

    const rating = resolveRating(input);
    const today = input.timeZone ? todayIn(input.timeZone) : undefined;
    const endedAt =
      input.status !== undefined && !ENDED_STATUSES.includes(input.status)
        ? null
        : parseEndedAt(input.endedAt, input.timeZone);
    // Evaluate against the row being updated, not a preceding read: a status-only PATCH must
    // clear an obsolete grade/date, and a grade-only PATCH cannot race a move to the backlog.
    const status = input.status ?? userGames.status;
    const storedRating = rating === undefined ? userGames.rating : rating;
    const storedEndedAt =
      endedAt === undefined
        ? today && input.status !== undefined && ENDED_STATUSES.includes(input.status)
          ? sql`coalesce(${userGames.endedAt}, ${today}::timestamp)`
          : userGames.endedAt
        : endedAt;

    const updated = await postgresDb.transaction(async (tx) => {
      const [changed] = await tx
        .update(userGames)
        .set({
          ...(input.status !== undefined && { status: input.status }),
          rating: sql`case when ${status} in (${UserGameStatus.WantToPlay}, ${UserGameStatus.Backlog}) then null else ${storedRating}::numeric end`,
          ...(input.review !== undefined && { review: input.review }),
          ...(input.mastered !== undefined && { mastered: input.mastered }),
          ...(input.spoilers !== undefined && { spoilers: input.spoilers }),
          ...(input.allowReactions !== undefined && { allowReactions: input.allowReactions }),
          ...(input.platformId !== undefined && { platformId: input.platformId }),
          endedAt: sql`case when ${status} in (${UserGameStatus.Finished}, ${UserGameStatus.Dropped}) then ${storedEndedAt}::timestamp else null end`,
        })
        .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
        .returning();

      if (!changed) throw new NotFoundError("Game not found in user's library");
      if (input.status === UserGameStatus.Finished) {
        const existing = await tx
          .select({ id: playthrough.id })
          .from(playthrough)
          .where(and(eq(playthrough.userId, userId), eq(playthrough.gameId, gameId)))
          .limit(1);
        if (!existing.length) {
          await tx.insert(playthrough).values({
            userId,
            gameId,
            platformId: changed.platformId,
            endedAt: changed.endedAt?.toISOString().slice(0, 10) ?? null,
          });
        }
      }
      return changed;
    });

    const [entry, community] = await Promise.all([
      libraryEntry(userId, gameId),
      GameService.community(gameId),
    ]);
    return {
      message: "Game updated successfully",
      game: {
        ...updated,
        rating: updated.rating !== null ? Number(updated.rating) : null,
        grade: gradeOf(updated.rating),
      },
      entry,
      community,
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
      community: await GameService.community(gameId),
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
    const owner = await requireUser(username, viewerId);
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
    const row = await postgresDb.transaction(async (tx) => {
      const [entry] = await tx
        .select({ id: userGames.id })
        .from(userGames)
        .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
        .for("update");
      if (!entry) throw new NotFoundError("Game not found in user's library");
      const [row] = await tx
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
      return row;
    });
    return { ...row, hours: row.hours !== null ? Number(row.hours) : null };
  }

  /** A stable client id makes an all-or-nothing batch safe to retry after a lost response. */
  static async addPlaythroughs(
    userId: string,
    gameId: number,
    inputs: (PlaythroughInput & { id: string })[],
  ) {
    if (
      !inputs.length ||
      inputs.length > 100 ||
      new Set(inputs.map((run) => run.id.toLowerCase())).size !== inputs.length
    ) {
      throw new BadRequestError("Supply 1 to 100 playthroughs with unique ids");
    }
    for (const input of inputs) await assertPlatformExists(input.platformId);
    const prepared = inputs.map((input) => ({
      id: input.id.toLowerCase(),
      userId,
      gameId,
      startedAt: parseDay(input.startedAt, "Start date") ?? null,
      endedAt: parseDay(input.endedAt, "End date") ?? null,
      hours: input.hours == null ? null : input.hours.toFixed(1),
      platformId: input.platformId ?? null,
      note: input.note?.trim() || null,
    }));
    const rows = await postgresDb.transaction(async (tx) => {
      const [entry] = await tx
        .select({ id: userGames.id })
        .from(userGames)
        .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
        .for("update");
      if (!entry) throw new NotFoundError("Game not found in user's library");
      await tx.insert(playthrough).values(prepared).onConflictDoNothing({ target: playthrough.id });
      const saved = await tx
        .select()
        .from(playthrough)
        .where(
          inArray(
            playthrough.id,
            prepared.map((run) => run.id),
          ),
        );
      const byId = new Map(saved.map((run) => [run.id, run]));
      return prepared.map((input) => {
        const row = byId.get(input.id);
        if (
          !row ||
          row.userId !== userId ||
          row.gameId !== gameId ||
          row.startedAt !== input.startedAt ||
          row.endedAt !== input.endedAt ||
          Number(row.hours ?? 0) !== Number(input.hours ?? 0) ||
          (row.hours === null) !== (input.hours === null) ||
          row.platformId !== input.platformId ||
          row.note !== input.note
        ) {
          throw new ConflictError("A playthrough id already belongs to a different save");
        }
        return { ...row, hours: row.hours === null ? null : Number(row.hours) };
      });
    });
    return rows;
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
      value: {
        status: status as UserGameStatus,
        rating: canGrade(status as UserGameStatus) ? rating : null,
        review,
        platformId,
        endedAt,
      },
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

      try {
        checkPublicText(value.review);
      } catch {
        errorGames.push({ gameId, error: "This review cannot be published" });
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
