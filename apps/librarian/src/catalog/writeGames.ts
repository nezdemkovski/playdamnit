import { and, getTableColumns, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db/postgres";
import {
  collection,
  company,
  cover,
  externalGame,
  game,
  gameLocalization,
  gameMode,
  gameToCollection,
  gameToCompany,
  gameToGameMode,
  gameToGenre,
  gameToPlatform,
  gameToTheme,
  genre,
  platform,
  screenshot,
  theme,
  type,
  video,
  website,
  websiteType,
} from "@playdamnit/db/schema";

import type { IGDBGameResponse } from "../utils/igdb/types";
import { createLogger } from "../utils/enhancedLogger";
import { deriveGame, type DerivedGame } from "./derive";
import { LogNamespace } from "../utils/enums";

const logger = createLogger(LogNamespace.CatalogWriter);

// Rows per INSERT; keeps every statement well under Postgres' 65535 parameters
const INSERT_CHUNK = 1000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Row = Record<string, unknown>;

const chunk = <T>(rows: T[], size = INSERT_CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

// ON CONFLICT DO UPDATE fails if one statement hits the same key twice
const uniqueById = <T extends { id: number }>(rows: T[]): T[] => [
  ...new Map(rows.map((row) => [row.id, row])).values(),
];

/**
 * `SET column = excluded.column` for every column of the table except `skip`. Keys are the
 * Drizzle property names (Drizzle ignores unknown keys silently), values reference the SQL
 * column names.
 */
const excludedColumns = (table: PgTable, skip: string[]): Record<string, SQL> =>
  Object.fromEntries(
    Object.entries(getTableColumns(table))
      .filter(([key]) => !skip.includes(key))
      .map(([key, column]) => [key, sql`excluded.${sql.identifier(column.name)}`]),
  );

/** Upsert rows keyed by `id`, refreshing every other column on conflict. */
const upsertById = async (tx: Tx, table: PgTable & { id: unknown }, rows: Row[]) => {
  const set = excludedColumns(table, ["id"]);
  for (const part of chunk(uniqueById(rows as { id: number }[]))) {
    await tx
      .insert(table)
      .values(part as never)
      .onConflictDoUpdate({ target: table.id as never, set: set as never });
  }
};

const writeLookups = async (tx: Tx, derived: DerivedGame[]) => {
  const all = (key: keyof DerivedGame["lookups"]): Row[] =>
    derived.flatMap((d) => d.lookups[key] as Row[]);

  await upsertById(tx, platform, all("platforms"));
  await upsertById(tx, genre, all("genres"));
  await upsertById(tx, gameMode, all("gameModes"));
  await upsertById(tx, theme, all("themes"));
  await upsertById(tx, type, all("gameTypes"));
  await upsertById(tx, websiteType, all("websiteTypes"));
  // Companies and collections referenced by a game may be newer than the last sync-lookups run
  await upsertById(tx, company, all("companies"));
  await upsertById(tx, collection, all("collections"));
};

const GAME_SET = excludedColumns(game, ["id", "createdAt"]);

const writeGameRows = async (tx: Tx, derived: DerivedGame[]) => {
  const rows = derived.map((d) => d.game);
  const ids = rows.map((r) => r.id);

  // IGDB may hand a slug to another game (merges, deletions); the old owner keeps its row
  // under a unique placeholder so the unique index doesn't reject the batch
  await tx
    .update(game)
    .set({ slug: sql`${game.slug} || '--moved-' || ${game.id}` })
    .where(
      and(
        inArray(
          game.slug,
          rows.map((r) => r.slug),
        ),
        notInArray(game.id, ids),
      ),
    );

  for (const part of chunk(rows)) {
    await tx.insert(game).values(part).onConflictDoUpdate({ target: game.id, set: GAME_SET });
  }
};

/** Replace a game-owned child table (covers, screenshots, ...) for the games in the batch. */
const replaceChildren = async (
  tx: Tx,
  table: PgTable & { id: unknown; gameId: unknown },
  gameIds: number[],
  rows: Row[],
) => {
  await tx.delete(table).where(inArray(table.gameId as never, gameIds));
  // A child id can move between games; updating on conflict keeps IGDB's current owner
  await upsertById(tx, table, rows);
};

const replaceJunction = async (
  tx: Tx,
  table: PgTable & { gameId: unknown },
  gameIds: number[],
  rows: Row[],
) => {
  await tx.delete(table).where(inArray(table.gameId as never, gameIds));
  for (const part of chunk(rows)) {
    await tx
      .insert(table)
      .values(part as never)
      .onConflictDoNothing();
  }
};

/**
 * Upsert a batch of expanded IGDB games in one transaction: lookups, game rows, then every
 * child and junction table. ~30 statements for 500 games. Returns the number of games written.
 */
export const writeGamesBatch = async (games: IGDBGameResponse[]): Promise<number> => {
  const now = new Date();
  const derived = uniqueById(games).map((raw) => deriveGame(raw, now));
  if (derived.length === 0) return 0;
  const gameIds = derived.map((d) => d.game.id);

  await db.transaction(async (tx) => {
    await writeLookups(tx, derived);
    await writeGameRows(tx, derived);

    const children = <
      K extends "screenshots" | "websites" | "videos" | "externalGames" | "localizations",
    >(
      key: K,
    ): Row[] => derived.flatMap((d) => d[key] as Row[]);

    await replaceChildren(
      tx,
      cover,
      gameIds,
      derived.flatMap((d) => (d.cover ? [d.cover as Row] : [])),
    );
    await replaceChildren(tx, screenshot, gameIds, children("screenshots"));
    await replaceChildren(tx, website, gameIds, children("websites"));
    await replaceChildren(tx, video, gameIds, children("videos"));
    await replaceChildren(tx, externalGame, gameIds, children("externalGames"));
    await replaceChildren(tx, gameLocalization, gameIds, children("localizations"));

    const pairs = (
      key: "platformIds" | "genreIds" | "gameModeIds" | "themeIds" | "collectionIds",
      column: string,
    ): Row[] => derived.flatMap((d) => d[key].map((id) => ({ gameId: d.game.id, [column]: id })));

    await replaceJunction(tx, gameToPlatform, gameIds, pairs("platformIds", "platformId"));
    await replaceJunction(tx, gameToGenre, gameIds, pairs("genreIds", "genreId"));
    await replaceJunction(tx, gameToGameMode, gameIds, pairs("gameModeIds", "gameModeId"));
    await replaceJunction(tx, gameToTheme, gameIds, pairs("themeIds", "themeId"));
    await replaceJunction(tx, gameToCollection, gameIds, pairs("collectionIds", "collectionId"));
    await replaceJunction(
      tx,
      gameToCompany,
      gameIds,
      derived.flatMap((d) => d.companyRoles as Row[]),
    );
  });

  logger.info(`writeGamesBatch: ${derived.length} games written`);
  return derived.length;
};
