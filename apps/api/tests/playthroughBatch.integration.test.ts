import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { UserGameStatus } from "@playdamnit/db/enums";
import { Grade, VerdictSource } from "@/utils/enums";
import { todayIn } from "@/modules/userGame/completionDate";

const TEST_URL = process.env.TEST_POSTGRES_URL;
describe.skipIf(!TEST_URL)("atomic playthrough batches and completion defaults", () => {
  let pg: Client;
  let service: typeof import("@/modules/userGame/service").UserGameService;
  const user = "batch-rules-test";
  const game = 938001;
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
    for (let id = game; id < game + 5; id++) {
      await pg.query(
        "insert into game (id, name, slug, total_rating_count) values ($1, $2, $2, 100) on conflict do nothing",
        [id, `batch-rules-${id}`],
      );
    }
    service = (await import("@/modules/userGame/service")).UserGameService;
    await service.addUserGame(user, game, { status: UserGameStatus.Playing, platformId: 6 });
    await service.addUserGame(user, game + 1, { status: UserGameStatus.Playing, platformId: 6 });
  });
  afterAll(async () => {
    await pg?.end();
  });

  test("the detail and write response share the server-selected verdict", async () => {
    await pg.query("update game set total_rating = 95, total_rating_count = 500 where id = $1", [
      game,
    ]);
    await pg.query('delete from "user" where id like $1', [`${user}-vote-%`]);
    for (let i = 0; i < 9; i++) {
      const voter = `${user}-vote-${i}`;
      await pg.query(
        'insert into "user" (id, name, email, email_verified, username) values ($1, $1, $2, true, $1)',
        [voter, `${voter}@example.test`],
      );
      await pg.query(
        "insert into user_games (user_id, game_id, status, rating) values ($1, $2, $3, 5)",
        [voter, game, UserGameStatus.Playing],
      );
    }
    const { GameService } = await import("@/modules/game/service");
    expect((await GameService.findById(game)).community.verdict).toEqual({
      source: VerdictSource.Overall,
      grade: Grade.S,
      count: 500,
    });
    const updated = await service.updateUserGame(user, game, { rating: 5 });
    expect(updated.community.verdict).toEqual({
      source: VerdictSource.Members,
      grade: Grade.D,
      count: 10,
    });
    expect((await GameService.findById(game)).community.verdict).toEqual(updated.community.verdict);
  });

  test("concurrent retries save exactly one copy of each run in request order", async () => {
    const runs = [
      { id: randomUUID().toUpperCase(), endedAt: "2025-01-02", hours: 12.5, platformId: 6 },
      { id: randomUUID(), hours: 8, note: "  replay  " },
    ];
    const [first, retry] = await Promise.all([
      service.addPlaythroughs(user, game, runs),
      service.addPlaythroughs(user, game, runs),
    ]);
    expect(first.map((r) => r.id)).toEqual(runs.map((r) => r.id.toLowerCase()));
    expect(retry).toEqual(first);
    const saved = await service.listPlaythroughs(user, game, user);
    expect(saved).toHaveLength(2);
    expect(saved.find((r) => r.hours === 8)?.note).toBe("replay");
    // A successful response lost on the wire is also a safe retry.
    expect(await service.addPlaythroughs(user, game, runs)).toEqual(first);
  });

  test("a conflicting id rolls back every new row in the batch", async () => {
    const id = randomUUID();
    await service.addPlaythroughs(user, game, [{ id, hours: 1 }]);
    const newId = randomUUID();
    await expect(
      service.addPlaythroughs(user, game, [
        { id: newId, hours: 3 },
        { id, hours: 2 },
      ]),
    ).rejects.toThrow("different save");
    const { rows } = await pg.query("select id from playthrough where id = $1", [newId]);
    expect(rows).toHaveLength(0);
    await expect(service.addPlaythroughs(user, game + 1, [{ id, hours: 1 }])).rejects.toThrow(
      "different save",
    );
  });

  test("bad input and a missing entry cannot partially save", async () => {
    await expect(
      service.addPlaythroughs(user, game, [
        { id: randomUUID(), hours: 2 },
        { id: randomUUID(), platformId: 99999999 },
      ]),
    ).rejects.toThrow("Unknown platform");
    const id = randomUUID();
    await expect(service.addPlaythroughs(user, game, [{ id }, { id }])).rejects.toThrow(
      "unique ids",
    );
    await expect(service.addPlaythroughs(user, game + 4, [{ id }])).rejects.toThrow(
      "Game not found",
    );
  });

  test("server supplies local today, preserves existing dates, and honors an explicit clear", async () => {
    const timeZone = "Pacific/Kiritimati";
    await service.addUserGame(user, game + 2, {
      status: UserGameStatus.Finished,
      platformId: 6,
      timeZone,
    });
    let { rows } = await pg.query(
      "select ended_at::date::text as day from user_games where user_id = $1 and game_id = $2",
      [user, game + 2],
    );
    expect(rows[0].day).toBe(todayIn(timeZone));
    await service.updateUserGame(user, game + 1, {
      status: UserGameStatus.Finished,
      endedAt: "2025-01-02",
      timeZone,
    });
    await service.updateUserGame(user, game + 1, { status: UserGameStatus.Finished, timeZone });
    ({ rows } = await pg.query(
      "select ended_at::date::text as day from user_games where user_id = $1 and game_id = $2",
      [user, game + 1],
    ));
    expect(rows[0].day).toBe("2025-01-02");
    await service.updateUserGame(user, game + 1, { endedAt: null, timeZone });
    ({ rows } = await pg.query(
      "select ended_at from user_games where user_id = $1 and game_id = $2",
      [user, game + 1],
    ));
    expect(rows[0].ended_at).toBeNull();
    await service.updateUserGame(user, game + 1, { status: UserGameStatus.Finished, timeZone });
    ({ rows } = await pg.query(
      "select ended_at::date::text as day from user_games where user_id = $1 and game_id = $2",
      [user, game + 1],
    ));
    expect(rows[0].day).toBe(todayIn(timeZone));
  });

  test("legacy callers keep an unspecified date; explicit null on creation stays empty", async () => {
    await service.addUserGame(user, game + 3, { status: UserGameStatus.Finished, platformId: 6 });
    await service.addUserGame(user, game + 4, {
      status: UserGameStatus.Finished,
      platformId: 6,
      timeZone: "Europe/Prague",
      endedAt: null,
    });
    const { rows } = await pg.query(
      "select ended_at from user_games where user_id = $1 and game_id in ($2, $3)",
      [user, game + 3, game + 4],
    );
    expect(rows.every((r) => r.ended_at === null)).toBe(true);
  });
});
