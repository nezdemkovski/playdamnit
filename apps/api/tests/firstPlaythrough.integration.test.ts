import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "pg";
import { UserGameStatus } from "@playdamnit/db/enums";

const TEST_URL = process.env.TEST_POSTGRES_URL;
describe.skipIf(!TEST_URL)("first finished playthrough", () => {
  let pg: Client;
  let service: typeof import("@/modules/userGame/service").UserGameService;
  const user = "first-playthrough-test";
  const game = 939001;

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(TEST_URL!);
    pg = new Client(TEST_URL);
    await pg.connect();
    await pg.query('delete from "user" where id = $1', [user]);
    await pg.query(
      'insert into "user" (id, name, email, email_verified, username) values ($1, $1, $2, true, $1)',
      [user, `${user}@example.test`],
    );
    await pg.query(
      "insert into platform (id, name, slug) values (6, 'PC', 'win') on conflict do nothing",
    );
    for (let id = game; id < game + 8; id++) {
      await pg.query(
        "insert into game (id, name, slug, total_rating_count) values ($1, $2, $2, 100) on conflict do nothing",
        [id, `first-run-${id}`],
      );
    }
    service = (await import("@/modules/userGame/service")).UserGameService;
  });
  afterAll(async () => {
    await pg?.end();
  });

  test("adding finished creates one run with the selected date and platform", async () => {
    await service.addUserGame(user, game, {
      status: UserGameStatus.Finished,
      platformId: 6,
      endedAt: "2026-01-02",
    });
    const runs = await service.listPlaythroughs(user, game, user);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      endedAt: "2026-01-02",
      startedAt: null,
      platformId: 6,
      hours: null,
    });
  });

  test("repeated and concurrent finishes do not add another run", async () => {
    await service.addUserGame(user, game + 1, { status: UserGameStatus.Playing, platformId: 6 });
    await Promise.all(
      [1, 2].map(() =>
        service.updateUserGame(user, game + 1, {
          status: UserGameStatus.Finished,
          endedAt: "2026-02-02",
        }),
      ),
    );
    await service.updateUserGame(user, game + 1, { status: UserGameStatus.Playing });
    await service.updateUserGame(user, game + 1, { status: UserGameStatus.Finished });
    expect(await service.listPlaythroughs(user, game + 1, user)).toHaveLength(1);
  });

  test("a matching manual completion avoids an automatic duplicate", async () => {
    await service.addUserGame(user, game + 2, {
      status: UserGameStatus.Finished,
      platformId: 6,
      endedAt: "2026-01-01",
      playthroughs: [
        { endedAt: "2025-01-01", hours: 12, platformId: 6 },
        { endedAt: "2026-01-01", hours: 8, note: "NG+", platformId: 6 },
      ],
    });
    const runs = await service.listPlaythroughs(user, game + 2, user);
    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.hours).sort()).toEqual([12, 8]);
    await service.updateUserGame(user, game + 2, { status: UserGameStatus.Finished });
    expect(await service.listPlaythroughs(user, game + 2, user)).toHaveLength(2);
  });

  test("an end-only historical run and the selected finish both survive creation and reload", async () => {
    await service.addUserGame(user, game + 6, {
      status: UserGameStatus.Finished,
      platformId: 6,
      endedAt: "2026-10-19",
      playthroughs: [{ endedAt: "2025-03-04", platformId: 6 }],
    });
    const runs = await service.listPlaythroughs(user, game + 6, user);
    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.endedAt).toSorted()).toEqual(["2025-03-04", "2026-10-19"]);
    expect(runs.every((run) => run.startedAt === null && run.hours === null)).toBe(true);
    await service.updateUserGame(user, game + 6, {
      status: UserGameStatus.Finished,
      endedAt: "2026-10-19",
    });
    expect(await service.listPlaythroughs(user, game + 6, user)).toHaveLength(2);
  });

  test("a same-day manual run keeps its details without a duplicate", async () => {
    await service.addUserGame(user, game + 7, {
      status: UserGameStatus.Finished,
      platformId: 6,
      endedAt: "2026-10-19",
      playthroughs: [{ endedAt: "2026-10-19", platformId: 6, hours: 10, note: "First finish" }],
    });
    const runs = await service.listPlaythroughs(user, game + 7, user);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ endedAt: "2026-10-19", hours: 10, note: "First finish" });
  });

  test("invalid drafts do not leave a partially added game", async () => {
    await expect(
      service.addUserGame(user, game + 3, {
        status: UserGameStatus.Finished,
        platformId: 6,
        playthroughs: [{ endedAt: "invalid" }],
      }),
    ).rejects.toThrow();
    const entries = await pg.query(
      "select id from user_games where user_id = $1 and game_id = $2",
      [user, game + 3],
    );
    expect(entries.rows).toHaveLength(0);
  });

  test("unfinished games get no automatic run; an existing manual run prevents another", async () => {
    await service.addUserGame(user, game + 4, { status: UserGameStatus.Playing, platformId: 6 });
    expect(await service.listPlaythroughs(user, game + 4, user)).toHaveLength(0);
    await service.addPlaythrough(user, game + 4, { hours: 20, platformId: 6 });
    await service.updateUserGame(user, game + 4, { status: UserGameStatus.Finished });
    expect(await service.listPlaythroughs(user, game + 4, user)).toHaveLength(1);
  });
});
