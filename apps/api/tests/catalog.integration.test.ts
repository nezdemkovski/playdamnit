// Integration tests for the backend ⇄ librarian contract (pg-boss + LISTEN/NOTIFY),
// with an in-process fake librarian. Needs a disposable database:
//   TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PgBoss } from "pg-boss";
import { Client } from "pg";

const TEST_URL = process.env.TEST_POSTGRES_URL;

describe.skipIf(!TEST_URL)("catalog requests (integration)", () => {
  let fakeLibrarian: PgBoss;
  let pg: Client;
  let mod: {
    searchGamesWithCache: typeof import("@/utils/searchGames").searchGamesWithCache;
    UserGameService: typeof import("@/modules/userGame/service").UserGameService;
    notify: typeof import("@/utils/pgNotify");
    stopBoss: typeof import("@/utils/pgBoss").stopBoss;
  };

  const insertGame = (id: number, name: string) =>
    pg.query(
      `insert into game (id, name, slug) values ($1, $2, $3) on conflict do nothing`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, "-")}-${id}`]
    );

  const notify = (requestId: string, ok: boolean) =>
    pg.query(`select pg_notify('game_catalog_updated', $1)`, [JSON.stringify({ requestId, ok })]);

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(TEST_URL!);

    pg = new Client(TEST_URL);
    await pg.connect();
    await pg.query(`truncate "user", game, igdb_search_log cascade`);

    // Fake librarian: "IGDB" knows any id, and searches for "Zzyzx" find one game
    fakeLibrarian = new PgBoss(TEST_URL!);
    await fakeLibrarian.start();
    for (const name of ["search-igdb", "fetch-by-ids", "process-similar-games"]) {
      await fakeLibrarian.createQueue(name);
    }
    await fakeLibrarian.work<{ query: string; requestId: string }>(
      "search-igdb",
      { pollingIntervalSeconds: 0.5 },
      async ([job]) => {
        if (job.data.query.toLowerCase().includes("zzyzx")) await insertGame(900001, "Zzyzx Quest");
        await notify(job.data.requestId, true);
      }
    );
    await fakeLibrarian.work<{ ids: number[]; requestId?: string }>(
      "fetch-by-ids",
      { pollingIntervalSeconds: 0.5 },
      async ([job]) => {
        for (const id of job.data.ids.filter((id) => id < 950000)) await insertGame(id, `Game ${id}`);
        if (job.data.requestId) await notify(job.data.requestId, true);
      }
    );

    mod = {
      searchGamesWithCache: (await import("@/utils/searchGames")).searchGamesWithCache,
      UserGameService: (await import("@/modules/userGame/service")).UserGameService,
      notify: await import("@/utils/pgNotify"),
      stopBoss: (await import("@/utils/pgBoss")).stopBoss,
    };
    await mod.notify.initNotifyListener();
  });

  afterAll(async () => {
    await mod?.notify.closeNotifyListener();
    await mod?.stopBoss();
    await fakeLibrarian?.stop({ graceful: false });
    await pg?.end();
  });

  test("a catalog miss is filled through the librarian, then served locally", async () => {
    const first = await mod.searchGamesWithCache("Zzyzx");
    expect(first.meta.source).toBe("igdb");
    expect(first.results.map((g) => g.name)).toEqual(["Zzyzx Quest"]);

    const second = await mod.searchGamesWithCache("Zzyzx");
    expect(second.meta.source).toBe("database");
    expect(second.results.map((g) => g.name)).toEqual(["Zzyzx Quest"]);
  }, 15_000);

  test("LIKE wildcards in the query are matched literally", async () => {
    const result = await mod.searchGamesWithCache("%");
    expect(result.results).toEqual([]);
  }, 15_000);

  test("import fetches missing games and reports the ones IGDB doesn't have", async () => {
    await pg.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at, username)
       values ('u1', 'U', 'u@example.com', true, now(), now(), 'u1')`
    );

    const rows = [
      ...Array.from({ length: 30 }, (_, i) => ({ gameId: 800000 + i, status: "backlog" })),
      { gameId: 960000, status: "playing" },
    ];
    const result = await mod.UserGameService.importUserGames("u1", rows, false);

    expect(result.imported).toBe(30);
    expect(result.fetchedFromIGDB).toBe(30);
    expect(result.details.errorGames).toEqual([
      { gameId: 960000, error: "Game not found in database and could not be fetched from IGDB" },
    ]);

    const again = await mod.UserGameService.importUserGames("u1", rows.slice(0, 2), false);
    expect(again.skipped).toBe(2);

    const library = await mod.UserGameService.getUserGames("u1");
    expect(library.meta.total).toBe(30);
  }, 30_000);
});
