// Integration test for the library reads the iOS app used to work out from a whole library: the
// status counts, the Steam link on /me, the Now tab and the tier board.
// Needs a disposable database:
//   TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "pg";
import { UserGameStatus } from "@playdamnit/db/enums";
import { ForbiddenError } from "@/utils/errors";
import { Grade } from "@/utils/enums";

const TEST_URL = process.env.TEST_POSTGRES_URL;
const DAY_SECONDS = 86_400;

describe.skipIf(!TEST_URL)("library reads (integration)", () => {
  let pg: Client;
  let UserService: typeof import("@/modules/user/service").UserService;
  let UserGameService: typeof import("@/modules/userGame/service").UserGameService;

  // Noon (UTC) of the day `days` from today, as IGDB stores a release day
  const todayStart = Math.floor(Date.now() / 1000 / DAY_SECONDS) * DAY_SECONDS;
  const releaseIn = (days: number) => todayStart + days * DAY_SECONDS + DAY_SECONDS / 2;

  /** id → [name, status, rating, days since added and last touched, release day from today] */
  const ENTRIES: [number, string, UserGameStatus, number | null, number, number | null][] = [
    [950001, "Alpha Strike", UserGameStatus.Playing, null, 5, null],
    [950002, "Bravo", UserGameStatus.Playing, null, 1, null],
    [950003, "Charlie", UserGameStatus.Finished, 9.5, 20, null],
    [950004, "Delta", UserGameStatus.Dropped, 3, 21, null],
    [950005, "Echo", UserGameStatus.OnHold, null, 3, null],
    [950006, "Foxtrot", UserGameStatus.Finished, null, 4, null],
    [950007, "Golf", UserGameStatus.Online, null, 6, null],
    [950008, "Hotel", UserGameStatus.Finished, 9.2, 2, null],
    [950009, "India", UserGameStatus.Backlog, null, 30, null],
    [950010, "Juliett", UserGameStatus.Backlog, null, 10, 3],
    [950011, "Kilo", UserGameStatus.Backlog, null, 50, null],
    [950012, "Lima", UserGameStatus.Backlog, null, 5, null],
    [950013, "Mike", UserGameStatus.Backlog, null, 1, null],
    [950014, "November", UserGameStatus.WantToPlay, null, 7, 1],
    [950015, "Oscar", UserGameStatus.WantToPlay, null, 7, 10],
    [950016, "Papa", UserGameStatus.WantToPlay, null, 7, -1],
    [950017, "Quebec", UserGameStatus.WantToPlay, null, 7, -2],
    [950018, "Romeo", UserGameStatus.Playing, null, 8, 2],
  ];

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(TEST_URL!);
    pg = new Client(TEST_URL);
    await pg.connect();
    await pg.query(`truncate "user", game cascade`);
    for (const [id, name, , , , release] of ENTRIES) {
      await pg.query(
        `insert into game (id, name, slug, first_release_date, search_names) values ($1, $2, $3, $4, $5)`,
        [
          id,
          name,
          `game-${id}`,
          release === null ? 1_600_000_000 : releaseIn(release),
          // Hotel is also known as Ostrich Quest
          id === 950008 ? `${name} Ostrich Quest` : name,
        ],
      );
      await pg.query(`insert into cover (id, game_id, hash) values ($1, $2, 'co1234')`, [
        id + 1000,
        id,
      ]);
    }
    for (const [u, listPublic] of [
      ["nowa", true],
      ["shut", false],
      ["peek", true],
    ] as const) {
      await pg.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at, username, list_public)
         values ($1, $1, $2, true, now(), now(), $1, $3)`,
        [u, `${u}@example.com`, listPublic],
      );
    }
    await pg.query(
      `update "user" set steam_id = '76561198000000001', steam_name = 'Nowa on Steam' where id = 'nowa'`,
    );
    ({ UserService } = await import("@/modules/user/service"));
    ({ UserGameService } = await import("@/modules/userGame/service"));

    for (const [id, , status, rating, days] of ENTRIES) {
      await UserGameService.addUserGame("nowa", id, { status, rating, platformId: null });
      await pg.query(
        `update user_games set added_at = now() - make_interval(days => $2), updated_at = now() - make_interval(days => $2)
         where user_id = 'nowa' and game_id = $1`,
        [id, days],
      );
    }
    await UserGameService.addUserGame("shut", 950003, {
      status: UserGameStatus.Finished,
      rating: 9.5,
      platformId: null,
    });
  });

  afterAll(async () => {
    await pg?.end();
  });

  test("the profile counts every status", async () => {
    const { stats } = await UserService.findByUsername("nowa", "peek");
    expect(stats?.statusCounts).toEqual({
      [UserGameStatus.Finished]: 3,
      [UserGameStatus.Playing]: 3,
      [UserGameStatus.Dropped]: 1,
      [UserGameStatus.Online]: 1,
      [UserGameStatus.OnHold]: 1,
      [UserGameStatus.WantToPlay]: 4,
      [UserGameStatus.Backlog]: 5,
    });
  });

  test("/me carries the Steam link", async () => {
    expect(await UserService.findById("nowa")).toMatchObject({
      steamId: "76561198000000001",
      steamName: "Nowa on Steam",
    });
    expect(await UserService.findById("peek")).toMatchObject({ steamId: null, steamName: null });
  });

  test("the grading deck leaves out the statuses that cannot carry a grade", async () => {
    const { results } = await UserGameService.getLibraryIndex("nowa", "nowa", { graded: false });
    // Newest first: Bravo (1 day), Echo (3), Foxtrot (4), Alpha (5), Golf (6), Romeo (8)
    expect(results.map((e) => e.name)).toEqual([
      "Bravo",
      "Echo",
      "Foxtrot",
      "Alpha Strike",
      "Golf",
      "Romeo",
    ]);
  });

  test("the overview's playing rail is the most recently touched first", async () => {
    const { playing } = await UserGameService.getOverview("nowa", null);
    expect(playing.map((e) => e.name)).toEqual(["Bravo", "Alpha Strike", "Romeo"]);
  });

  test("Now: playing, the deck, up next and this week", async () => {
    const now = await UserGameService.getNow("nowa");
    expect(now.playing.map((e) => e.name)).toEqual(["Bravo", "Alpha Strike", "Romeo"]);
    // The deck's first covers, in the deck's order, and how many wait in all
    expect(now.toGrade.total).toBe(6);
    expect(now.toGrade.games.map((e) => e.name)).toEqual(["Bravo", "Echo", "Foxtrot"]);
    // The backlog, longest idle first, four of it
    expect(now.upNext.map((e) => e.name)).toEqual(["Kilo", "India", "Juliett", "Lima"]);
    expect(now.upNext[0].userGameData.idle.days).toBe(50);
    // Wanted or backlogged, out from yesterday through a week ahead, soonest first; a playing
    // game releasing this week is not on it
    expect(now.thisWeek.map((e) => e.name)).toEqual(["Papa", "November", "Juliett"]);
  });

  test("Now for an empty library is empty", async () => {
    expect(await UserGameService.getNow("peek", { tz: "Not/AZone" })).toEqual({
      playing: [],
      toGrade: { total: 0, games: [] },
      upNext: [],
      thisWeek: [],
    });
  });

  test("tiers: graded entries by grade, S to F, newest first in each", async () => {
    const board = await UserGameService.getTiers("nowa", "peek");
    expect(board.tiers.map((tier) => tier.grade)).toEqual([
      Grade.S,
      Grade.A,
      Grade.B,
      Grade.C,
      Grade.D,
      Grade.F,
    ]);
    const byGrade = Object.fromEntries(
      board.tiers.map((tier) => [tier.grade, tier.games.map((e) => e.name)]),
    );
    expect(byGrade).toEqual({
      S: ["Hotel", "Charlie"],
      A: [],
      B: [],
      C: [],
      D: [],
      F: ["Delta"],
    });
    expect(board.tiers[0].count).toBe(2);
    expect(board.total).toBe(ENTRIES.length);
    expect(board.ungraded).toBe(6);
  });

  test("tiers narrow by status and by any of the game's names", async () => {
    const dropped = await UserGameService.getTiers("nowa", null, {
      status: UserGameStatus.Dropped,
    });
    expect(dropped.tiers.flatMap((tier) => tier.games.map((e) => e.name))).toEqual(["Delta"]);
    expect(dropped).toMatchObject({ total: 1, ungraded: 0 });

    const alias = await UserGameService.getTiers("nowa", null, { q: " ostrich " });
    expect(alias.tiers[0].games.map((e) => e.name)).toEqual(["Hotel"]);
    expect(alias.total).toBe(1);
  });

  test("the routes: tiers by name beside games/:id, Now behind a session", async () => {
    const { routes } = await import("@/routes");
    const tiers = await routes.handle(
      new Request("http://localhost/user/nowa/games/tiers?status=dropped&q=del"),
    );
    expect(tiers.status).toBe(200);
    const board = (await tiers.json()) as { tiers: { games: { name: string }[] }[] };
    expect(board.tiers.at(-1)?.games[0]?.name).toBe("Delta");
    const now = await routes.handle(new Request("http://localhost/me/now"));
    expect(now.status).toBe(401);
  });

  test("a private list's tiers are its owner's only", async () => {
    await expect(UserGameService.getTiers("shut", "peek")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(UserGameService.getTiers("shut", null)).rejects.toBeInstanceOf(ForbiddenError);
    const own = await UserGameService.getTiers("shut", "shut");
    expect(own.tiers[0].games.map((e) => e.id)).toEqual([950003]);
  });
});
