import { requireVisibleAuthor } from "@/modules/moderation/visibility";
import { checkPublicText } from "@/modules/moderation/filter";
import { and, count, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { game, gameList, gameListItem } from "@playdamnit/db/schema";
import { GAME_CARD_COLUMNS, GAME_CARD_WITH, transformGameResponse } from "@/utils/gameTransformers";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/utils/errors";
import { PUBLIC_USER_COLUMNS } from "@/utils/social";

export const MAX_LIST_GAMES = 500;
const PREVIEW_COVERS = 5;

interface ListInput {
  name: string;
  description?: string | null;
  isPublic?: boolean;
}

const summary = (
  list: {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: { id: string; username: string | null; name: string; image: string | null };
    items?: {
      position: number;
      game: { id: number; cover: { hash: string; source: string } | null };
    }[];
  },
  gamesCount: number,
) => ({
  id: list.id,
  name: list.name,
  description: list.description,
  isPublic: list.isPublic,
  createdAt: list.createdAt,
  updatedAt: list.updatedAt,
  user: list.user,
  gamesCount,
  // The first few covers, for the list card
  covers: (list.items ?? [])
    .sort((a, b) => a.position - b.position)
    .slice(0, PREVIEW_COVERS)
    .map(
      (item) => transformGameResponse({ ...item.game, platforms: [], genres: [] } as never).cover,
    ),
});

/** Custom, ordered collections of games ("Top 10 of 2025", "Cozy games") */
export abstract class ListService {
  static async forUser(userId: string, viewerId: string | null) {
    await requireVisibleAuthor(userId, viewerId);
    const rows = await db.query.gameList.findMany({
      where: { userId, ...(userId !== viewerId && { isPublic: true }) },
      orderBy: { updatedAt: "desc" },
      with: {
        items: {
          columns: { position: true },
          with: { game: { columns: { id: true }, with: { cover: true } } },
        },
      },
    });
    return rows.map((list) => summary(list, list.items.length));
  }

  static async get(listId: string, viewerId: string | null) {
    const list = await db.query.gameList.findFirst({
      where: { id: listId },
      with: {
        user: { columns: PUBLIC_USER_COLUMNS },
        items: {
          orderBy: { position: "asc" },
          with: { game: { columns: GAME_CARD_COLUMNS, with: GAME_CARD_WITH } },
        },
      },
    });
    if (!list || (!list.isPublic && list.userId !== viewerId))
      throw new NotFoundError("List not found");
    await requireVisibleAuthor(list.userId, viewerId);
    return {
      ...summary(list, list.items.length),
      games: list.items.map((item) => ({
        ...transformGameResponse(item.game),
        position: item.position,
        note: item.note,
      })),
    };
  }

  static async create(userId: string, input: ListInput) {
    checkPublicText(input.name, input.description);
    const [created] = await db
      .insert(gameList)
      .values({
        userId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isPublic: input.isPublic ?? true,
      })
      .returning();
    return summary(created, 0);
  }

  private static async own(listId: string, userId: string) {
    const list = await db.query.gameList.findFirst({ where: { id: listId } });
    if (!list) throw new NotFoundError("List not found");
    if (list.userId !== userId) throw new ForbiddenError("Not your list");
    return list;
  }

  static async update(listId: string, userId: string, input: Partial<ListInput>) {
    checkPublicText(input.name, input.description);
    await ListService.own(listId, userId);
    const [updated] = await db
      .update(gameList)
      .set({
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description?.trim() || null }),
        ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
      })
      .where(eq(gameList.id, listId))
      .returning();
    const [{ n }] = await db
      .select({ n: count() })
      .from(gameListItem)
      .where(eq(gameListItem.listId, listId));
    return summary(updated, Number(n));
  }

  static async remove(listId: string, userId: string) {
    await ListService.own(listId, userId);
    await db.delete(gameList).where(eq(gameList.id, listId));
    return { message: "Removed successfully", id: listId };
  }

  /** Replace the whole ordered content (used by the list editor) */
  static async setGames(listId: string, userId: string, gameIds: number[]) {
    await ListService.own(listId, userId);
    const unique = [...new Set(gameIds)];
    if (unique.length > MAX_LIST_GAMES)
      throw new BadRequestError(`A list holds at most ${MAX_LIST_GAMES} games`);
    const known = unique.length
      ? new Set(
          (await db.select({ id: game.id }).from(game).where(inArray(game.id, unique))).map(
            (r) => r.id,
          ),
        )
      : new Set<number>();
    const missing = unique.filter((id) => !known.has(id));
    if (missing.length) throw new BadRequestError(`Unknown games: ${missing.join(", ")}`);

    await db.transaction(async (tx) => {
      await tx.delete(gameListItem).where(eq(gameListItem.listId, listId));
      if (unique.length) {
        await tx
          .insert(gameListItem)
          .values(unique.map((gameId, position) => ({ listId, gameId, position })));
      }
      await tx.update(gameList).set({ updatedAt: new Date() }).where(eq(gameList.id, listId));
    });
    return { count: unique.length };
  }

  static async addGame(listId: string, userId: string, gameId: number) {
    await ListService.own(listId, userId);
    const exists = await db.query.game.findFirst({ where: { id: gameId }, columns: { id: true } });
    if (!exists) throw new NotFoundError("Game not found");
    const [{ n }] = await db
      .select({ n: count() })
      .from(gameListItem)
      .where(eq(gameListItem.listId, listId));
    if (Number(n) >= MAX_LIST_GAMES)
      throw new BadRequestError(`A list holds at most ${MAX_LIST_GAMES} games`);
    await db
      .insert(gameListItem)
      .values({ listId, gameId, position: Number(n) })
      .onConflictDoNothing();
    await db.update(gameList).set({ updatedAt: new Date() }).where(eq(gameList.id, listId));
    return { added: true };
  }

  static async removeGame(listId: string, userId: string, gameId: number) {
    await ListService.own(listId, userId);
    await db
      .delete(gameListItem)
      .where(and(eq(gameListItem.listId, listId), eq(gameListItem.gameId, gameId)));
    await db.update(gameList).set({ updatedAt: new Date() }).where(eq(gameList.id, listId));
    return { added: false };
  }

  /** How many of the owner's lists hold the game, counting only the lists the viewer can see */
  static async countContaining(ownerId: string, gameId: number, viewerId: string | null) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(gameListItem)
      .innerJoin(gameList, eq(gameList.id, gameListItem.listId))
      .where(
        and(
          eq(gameList.userId, ownerId),
          eq(gameListItem.gameId, gameId),
          ownerId === viewerId ? undefined : eq(gameList.isPublic, true),
        ),
      );
    return Number(n);
  }

  /** The viewer's lists with a flag for whether each contains the game ("Manage lists") */
  static async membership(userId: string, gameId: number) {
    const rows = await db
      .select({
        id: gameList.id,
        name: gameList.name,
        isPublic: gameList.isPublic,
        contains: sql<boolean>`exists (select 1 from ${gameListItem} where ${gameListItem.listId} = ${gameList.id} and ${gameListItem.gameId} = ${gameId})`,
      })
      .from(gameList)
      .where(eq(gameList.userId, userId))
      .orderBy(sql`${gameList.updatedAt} desc`);
    return rows.map((row) => ({ ...row, contains: !!row.contains }));
  }
}
