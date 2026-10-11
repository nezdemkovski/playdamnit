import { PgBoss } from "pg-boss";
import { inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db/postgres";
import {
  collection,
  company,
  externalGameSource,
  game,
  gameMode,
  gameTimeToBeat,
  genre,
  platform,
  syncState,
  theme,
  type,
  websiteType,
} from "@playdamnit/db/schema";
import { QUEUES } from "@playdamnit/db/jobs";
import { fetchAllIGDB } from "../utils/igdb/utils";
import { createLogger } from "../utils/enhancedLogger";

const logger = createLogger("lookups-worker");

// A startup run is skipped when the last one finished less recently than this
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;
const SYNC_STATE_ENTITY = "lookups";

type Named = { id: number; name: string; slug: string };
type Typed = { id: number; type: string };

const uniqueById = <T extends { id: number }>(rows: T[]) => [
  ...new Map(rows.map((row) => [row.id, row])).values(),
];

/**
 * Upsert lookup rows by IGDB id. `set` lists the columns refreshed on conflict; every lookup
 * table has `id` as its primary key.
 */
const upsert = async <T extends PgTable & { id: unknown }>(
  table: T,
  rows: Record<string, unknown>[],
  set: Record<string, unknown>,
) => {
  if (rows.length === 0) return;
  // Row shapes are checked by the typed loaders below; the generic insert needs a loose type
  await db
    .insert(table)
    .values(rows as never)
    .onConflictDoUpdate({ target: table.id as never, set: set as never });
};

const NAMED_SET = { name: sql`excluded.name`, slug: sql`excluded.slug` };

const syncNamed = (endpoint: string, table: PgTable & { id: unknown }) =>
  fetchAllIGDB<Named>(endpoint, "id,name,slug", (rows) =>
    upsert(
      table,
      uniqueById(rows).map(({ id, name, slug }) => ({ id, name, slug })),
      NAMED_SET,
    ),
  );

const syncTyped = (endpoint: string, table: PgTable & { id: unknown }) =>
  fetchAllIGDB<Typed>(endpoint, "id,type", (rows) =>
    upsert(
      table,
      uniqueById(rows).map(({ id, type: name }) => ({ id, type: name })),
      { type: sql`excluded.type` },
    ),
  );

const syncPlatforms = () =>
  fetchAllIGDB<Named & { abbreviation?: string }>(
    "platforms",
    "id,name,slug,abbreviation",
    (rows) =>
      upsert(
        platform,
        uniqueById(rows).map(({ id, name, slug, abbreviation }) => ({
          id,
          name,
          slug,
          abbreviation: abbreviation ?? null,
        })),
        { ...NAMED_SET, abbreviation: sql`excluded.abbreviation` },
      ),
  );

const syncExternalGameSources = () =>
  fetchAllIGDB<{ id: number; name: string }>("external_game_sources", "id,name", (rows) =>
    upsert(
      externalGameSource,
      uniqueById(rows).map(({ id, name }) => ({ id, name })),
      { name: sql`excluded.name` },
    ),
  );

type TimeToBeat = {
  id: number;
  game_id: number;
  hastily?: number;
  normally?: number;
  completely?: number;
  count?: number;
};

// Rows reference games, so only the ones already in the catalog are kept (FK)
const syncTimeToBeat = () =>
  fetchAllIGDB<TimeToBeat>(
    "game_time_to_beats",
    "id,game_id,hastily,normally,completely,count",
    async (rows) => {
      const gameIds = [...new Set(rows.map((row) => row.game_id))];
      const known = new Set(
        (await db.select({ id: game.id }).from(game).where(inArray(game.id, gameIds))).map(
          (row) => row.id,
        ),
      );
      const values = [
        ...new Map(
          rows
            .filter((row) => known.has(row.game_id))
            .map((row) => [
              row.game_id,
              {
                gameId: row.game_id,
                hastily: row.hastily ?? null,
                normally: row.normally ?? null,
                completely: row.completely ?? null,
                count: row.count ?? null,
              },
            ]),
        ).values(),
      ];
      if (values.length === 0) return;
      await db
        .insert(gameTimeToBeat)
        .values(values)
        .onConflictDoUpdate({
          target: gameTimeToBeat.gameId,
          set: {
            hastily: sql`excluded.hastily`,
            normally: sql`excluded.normally`,
            completely: sql`excluded.completely`,
            count: sql`excluded.count`,
          },
        });
    },
  );

const lastRunAt = async () => {
  const row = await db.query.syncState.findFirst({ where: { entity: SYNC_STATE_ENTITY } });
  return row?.lastRunAt ?? null;
};

/**
 * Mirror IGDB's lookup endpoints. Small ones fit in a request; companies and collections take a
 * few hundred. Writes are upserts by IGDB id, so renames land and nothing is ever deleted.
 */
export const syncLookups = async (opts: { force?: boolean } = {}) => {
  const previous = await lastRunAt();
  if (!opts.force && previous && Date.now() - previous.getTime() < MIN_INTERVAL_MS) {
    logger.info(`sync-lookups skipped: last run at ${previous.toISOString()}`);
    return;
  }

  const started = Date.now();
  const counts = {
    platforms: await syncPlatforms(),
    genres: await syncNamed("genres", genre),
    gameModes: await syncNamed("game_modes", gameMode),
    themes: await syncNamed("themes", theme),
    gameTypes: await syncTyped("game_types", type),
    websiteTypes: await syncTyped("website_types", websiteType),
    externalGameSources: await syncExternalGameSources(),
    collections: await syncNamed("collections", collection),
    companies: await syncNamed("companies", company),
    timeToBeat: await syncTimeToBeat(),
  };

  await db
    .insert(syncState)
    .values({ entity: SYNC_STATE_ENTITY, lastRunAt: new Date() })
    .onConflictDoUpdate({ target: syncState.entity, set: { lastRunAt: new Date() } });

  logger.info(`sync-lookups done in ${Math.round((Date.now() - started) / 1000)}s`, counts);
};

export const registerLookupsWorker = async (boss: PgBoss): Promise<void> => {
  await boss.work<{ force?: boolean }>(QUEUES.SYNC_LOOKUPS, async ([job]) => {
    await syncLookups(job.data ?? {});
  });
  await boss.schedule(QUEUES.SYNC_LOOKUPS, "30 3 * * *", { force: true });

  // Catch up after a deploy; the handler skips the run if the last one is recent enough
  await boss.send(
    QUEUES.SYNC_LOOKUPS,
    {},
    { singletonKey: "startup", singletonSeconds: 600, expireInSeconds: 3600 },
  );
};
