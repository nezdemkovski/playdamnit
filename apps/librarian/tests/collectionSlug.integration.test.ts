import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { collection } from "@playdamnit/db/schema";

const TEST_URL = process.env.TEST_POSTGRES_URL;

describe.skipIf(!TEST_URL)("collection slug migration", () => {
  let pg: Client;
  beforeAll(async () => {
    pg = new Client(TEST_URL);
    await pg.connect();
    // Session-local tables reproduce the previous constraint without changing shared fixtures.
    await pg.query(`create temporary table collection (
      id integer primary key, name text not null, slug text not null,
      constraint collection_slug_key unique (slug)
    )`);
    await pg.query("create index idx_collection_slug on collection (slug)");
    await pg.query(`create temporary table game_to_collection (
      game_id integer not null, collection_id integer references collection(id),
      primary key (game_id, collection_id)
    )`);
    await pg.query("insert into collection values (1, 'Original series', 'shared-series')");
    await pg.query("insert into game_to_collection values (7, 1)");
  });
  afterAll(async () => {
    await pg?.end();
  });

  test("the old constraint rejects the upstream slug collision", async () => {
    await expect(
      pg.query("insert into collection values (2, 'Another series', 'shared-series')"),
    ).rejects.toMatchObject({ code: "23505", constraint: "collection_slug_key" });
  });

  test("migration permits ID-based upserts and retries without losing collection links", async () => {
    const migration = await readFile(
      new URL(
        "../../../packages/db/migrations/20261019224624_collection_slug_not_unique/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pg.query(migration);
    const db = drizzle({ client: pg });
    const sync = () =>
      db
        .insert(collection)
        .values([
          { id: 1, name: "Renamed series", slug: "shared-series" },
          { id: 2, name: "Another series", slug: "shared-series" },
        ])
        .onConflictDoUpdate({
          target: collection.id,
          set: { name: sql`excluded.name`, slug: sql`excluded.slug` },
        });
    await sync();
    await sync();
    const { rows } = await pg.query("select * from collection order by id");
    expect(rows).toEqual([
      { id: 1, name: "Renamed series", slug: "shared-series" },
      { id: 2, name: "Another series", slug: "shared-series" },
    ]);
    expect((await pg.query("select * from game_to_collection")).rows).toEqual([
      { game_id: 7, collection_id: 1 },
    ]);
    const indexes = await pg.query(
      "select indexrelid::regclass::text as name from pg_index where indrelid = 'collection'::regclass",
    );
    expect(indexes.rows.some((row) => row.name === "idx_collection_slug")).toBe(true);
    expect(
      (
        await pg.query(
          "select count(*)::int as n from pg_constraint where conrelid = 'collection'::regclass and contype = 'p'",
        )
      ).rows[0].n,
    ).toBe(1);
  });
});
