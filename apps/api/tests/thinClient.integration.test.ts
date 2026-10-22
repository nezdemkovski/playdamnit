// Integration test for what the clients used to work out themselves: the username check, the
// profile overview rails, the grading queue, the preferred platforms and the idle facts.
// Needs a disposable database:
//   TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "pg";
import { UserGameStatus } from "@playdamnit/db/enums";
import { IdleKind, LibrarySort, UsernameProblem } from "@/utils/enums";

const TEST_URL = process.env.TEST_POSTGRES_URL;

describe.skipIf(!TEST_URL)("thin client reads (integration)", () => {
  let pg: Client;
  let UserService: typeof import("@/modules/user/service").UserService;
  let UserGameService: typeof import("@/modules/userGame/service").UserGameService;
  let checkUsername: typeof import("@/modules/user/username").checkUsername;
  let USERNAME_MIN: number;
  let USERNAME_MAX: number;

  const GAMES = [940001, 940002, 940003, 940004, 940005];
  const NO_COVER = 940006;

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(TEST_URL!);
    pg = new Client(TEST_URL);
    await pg.connect();
    await pg.query(`truncate "user", game cascade`);
    await pg.query(
      `insert into platform (id, name, slug) values (6, 'PC', 'win'), (48, 'PS4', 'ps4') on conflict do nothing`,
    );
    for (const id of [...GAMES, NO_COVER]) {
      await pg.query(
        `insert into game (id, name, slug, first_release_date) values ($1, $2, $3, 1600000000)`,
        [id, `Game ${id}`, `game-${id}`],
      );
      if (id !== NO_COVER) {
        await pg.query(`insert into cover (id, game_id, hash) values ($1, $2, 'co1234')`, [
          id + 1000,
          id,
        ]);
      }
    }
    for (const [u, listPublic] of [
      ["dana", true],
      ["dana_", true],
      ["hidden", false],
    ] as const) {
      await pg.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at, username, list_public)
         values ($1, $1, $2, true, now(), now(), $1, $3)`,
        [u, `${u}@example.com`, listPublic],
      );
    }
    ({ UserService } = await import("@/modules/user/service"));
    ({ UserGameService } = await import("@/modules/userGame/service"));
    ({ checkUsername, USERNAME_MIN, USERNAME_MAX } = await import("@/modules/user/username"));

    const [g1, g2, g3, g4, g5] = GAMES;
    await UserGameService.addUserGame("dana", g1, {
      status: UserGameStatus.Finished,
      rating: 9.5,
      platformId: 48,
      endedAt: "2026-01-02",
    });
    await UserGameService.addUserGame("dana", g2, {
      status: UserGameStatus.Playing,
      platformId: 6,
    });
    await UserGameService.addUserGame("dana", g3, {
      status: UserGameStatus.Dropped,
      rating: 4,
      platformId: 6,
      endedAt: "2026-03-04",
    });
    await UserGameService.addUserGame("dana", g4, { status: UserGameStatus.Backlog, rating: 0 });
    await UserGameService.addUserGame("dana", g5, { status: UserGameStatus.WantToPlay });
    await UserGameService.addUserGame("dana", NO_COVER, { status: UserGameStatus.Playing });
    // A playing game nobody has touched for two months, with Steam time on it
    await pg.query(
      `update user_games set updated_at = now() - interval '60 days', steam_minutes = 600 where game_id = $1`,
      [g2],
    );
    await pg.query(
      `update user_games set updated_at = now() - interval '12 days', added_at = now() - interval '12 days' where game_id = $1`,
      [g4],
    );
    await UserGameService.addUserGame("hidden", g1, { status: UserGameStatus.Playing });
  });

  afterAll(async () => {
    await pg?.end();
  });

  test("the server owns grade and finish-date rules for every write shape", async () => {
    await pg.query(`insert into "user" (id, name, email, email_verified, created_at, updated_at, username)
      values ('rules', 'rules', 'rules@example.com', true, now(), now(), 'rules')`);
    const id = GAMES[0]!;
    const created = await UserGameService.addUserGame("rules", id, {
      status: UserGameStatus.Backlog,
      rating: 9,
      endedAt: "2020-01-01",
    });
    expect(created.game.rating).toBeNull();
    expect(created.game.endedAt).toBeNull();
    const finished = await UserGameService.updateUserGame("rules", id, {
      status: UserGameStatus.Finished,
      rating: 8,
      endedAt: "2020-01-01",
    });
    expect(finished.game.rating).toBe(8);
    expect(finished.game.endedAt).not.toBeNull();
    const statusOnly = await UserGameService.updateUserGame("rules", id, {
      status: UserGameStatus.WantToPlay,
    });
    expect(statusOnly.game.rating).toBeNull();
    expect(statusOnly.game.endedAt).toBeNull();
    const gradeOnly = await UserGameService.updateUserGame("rules", id, { rating: 10 });
    expect(gradeOnly.game.rating).toBeNull();
    const dateOnly = await UserGameService.updateUserGame("rules", id, { endedAt: "2020-01-01" });
    expect(dateOnly.game.endedAt).toBeNull();
    await UserGameService.updateUserGame("rules", id, {
      status: UserGameStatus.Finished,
      rating: 7,
      endedAt: "2020-01-01",
    });
    const playing = await UserGameService.updateUserGame("rules", id, {
      status: UserGameStatus.Playing,
    });
    expect(playing.game.rating).toBe(7);
    expect(playing.game.endedAt).toBeNull();
    const reviewOnly = await UserGameService.updateUserGame("rules", id, { review: "Keep grade" });
    expect(reviewOnly.game.status).toBe(UserGameStatus.Playing);
    expect(reviewOnly.game.rating).toBe(7);
  });

  test("the username rule, with a reason for each break", async () => {
    expect(await checkUsername("ab", null)).toMatchObject({
      valid: false,
      available: false,
      reason: UsernameProblem.TooShort,
      // The rule's bounds, so the message needs no copy of them
      minLength: USERNAME_MIN,
      maxLength: USERNAME_MAX,
    });
    expect((await checkUsername("a".repeat(31), null)).reason).toBe(UsernameProblem.TooLong);
    expect((await checkUsername("no spaces", null)).reason).toBe(UsernameProblem.Characters);
    expect(await checkUsername("  fresh.name  ", null)).toEqual({
      username: "fresh.name",
      valid: true,
      available: true,
      reason: null,
      suggestions: [],
      minLength: 3,
      maxLength: 30,
    });
  });

  test("a taken name comes with three free ones made from it, case aside", async () => {
    const check = await checkUsername("Dana", null);
    expect(check).toMatchObject({ valid: true, available: false, reason: UsernameProblem.Taken });
    expect(check.suggestions).toHaveLength(3);
    // dana_ is taken too, so it is never offered
    expect(check.suggestions).not.toContain("Dana_");
    for (const s of check.suggestions) {
      expect((await checkUsername(s, null)).available).toBe(true);
    }
  });

  test("your own name counts as free", async () => {
    expect((await checkUsername("DANA", "dana")).available).toBe(true);
  });

  test("the overview rails", async () => {
    const [g1, g2, g3, g4, g5] = GAMES;
    const overview = await UserGameService.getOverview("dana", null);
    expect(overview.private).toBe(false);
    expect(overview.playing.map((e) => e.id).toSorted()).toEqual([g2, NO_COVER].toSorted());
    expect(overview.mostPlayed.map((e) => e.id)).toEqual([g2]);
    // Latest end first
    expect(overview.recent.map((e) => e.id)).toEqual([g3, g1]);
    // Covers only; graded best first, then the rest by when they were added
    expect(overview.shelf.map((e) => e.id)).toEqual([g1, g3, g5, g2, g4]);
    expect(overview.hallOfFame).toBe(true);
  });

  test("a private list's overview is empty to others and full to its owner", async () => {
    const outside = await UserGameService.getOverview("hidden", "dana");
    expect(outside).toMatchObject({ private: true, playing: [], shelf: [] });
    const own = await UserGameService.getOverview("hidden", "hidden");
    expect(own.playing).toHaveLength(1);
  });

  test("the grading queue: ungraded only, newest first", async () => {
    const [g1, g2, g3, g4, g5] = GAMES;
    const ungraded = await UserGameService.getLibraryIndex("dana", null, { graded: false });
    expect(ungraded.results.map((e) => e.id)).toEqual([NO_COVER, g5, g2, g4]);
    const graded = await UserGameService.getLibraryIndex("dana", null, { graded: true });
    expect(graded.results.map((e) => e.id).toSorted()).toEqual([g1, g3].toSorted());
  });

  test("a library page is ordered and counted as before", async () => {
    const [, g2, g3, , g5] = GAMES;
    const page = await UserGameService.getUserGames("dana", { limit: 2, offset: 1 });
    expect(page.results.map((e) => e.id)).toEqual([g5, g3]);
    expect(page.meta.total).toBe(6);
    const named = await UserGameService.getUserGames("dana", {
      limit: 3,
      sort: LibrarySort.Name,
      status: UserGameStatus.Playing,
    });
    expect(named.results.map((e) => e.id)).toEqual([g2, NO_COVER]);
  });

  test("preferred platforms, most used first", async () => {
    expect((await UserService.findById("dana")).preferredPlatformIds).toEqual([6, 48]);
    expect((await UserService.findById("hidden")).preferredPlatformIds).toEqual([]);
  });

  test("a game added without a platform goes on the member's most used one it is on", async () => {
    const onBoth = 940101;
    const onNone = 940102;
    for (const id of [onBoth, onNone]) {
      await pg.query(
        `insert into game (id, name, slug, first_release_date) values ($1, $2, $3, 1600000000)`,
        [id, `Game ${id}`, `game-${id}`],
      );
    }
    await pg.query(`insert into game_to_platform (game_id, platform_id) values ($1, 48), ($1, 6)`, [
      onBoth,
    ]);
    // dana logs on PC (6) twice and PS4 (48) once
    expect(await UserGameService.defaultPlatform("dana", onBoth)).toBe(6);
    // no history: the game's first platform
    expect(await UserGameService.defaultPlatform("dana_", onBoth)).toBe(6);
    // a game on no platform stays without one
    expect(await UserGameService.defaultPlatform("dana", onNone)).toBeNull();
    const added = await UserGameService.addUserGame("dana_", onBoth, {
      status: UserGameStatus.WantToPlay,
    });
    expect(added.entry?.userGameData.platformId).toBe(6);
    const kept = await UserGameService.addUserGame("dana_", onNone, {
      status: UserGameStatus.WantToPlay,
      platformId: null,
    });
    expect(kept.entry?.userGameData.platformId ?? null).toBeNull();
  });

  test("every entry carries its idle fact", async () => {
    const [g1, g2, g3, g4, g5] = GAMES;
    const { results } = await UserGameService.getLibraryIndex("dana", "dana");
    const idle = new Map(results.map((e) => [e.id, e.userGameData.idle]));
    expect(idle.get(g1)?.kind).toBe(IdleKind.Finished);
    expect(idle.get(g2)).toEqual({ kind: IdleKind.PlayingStale, days: 60 });
    expect(idle.get(g3)?.kind).toBe(IdleKind.Dropped);
    expect(idle.get(g4)).toEqual({ kind: IdleKind.Untouched, days: 12 });
    expect(idle.get(g5)).toEqual({ kind: IdleKind.Today, days: 0 });
    const list = await UserGameService.getUserGames("dana", { limit: 1 });
    expect(list.results[0].userGameData.idle.kind).toBeDefined();
  });

  test("sign-in methods: password, passkeys, and Apple unlinkable only beside another account", async () => {
    const { signInMethods } = await import("@/modules/user/signIn");
    expect(await signInMethods("dana")).toEqual({
      password: false,
      passkeys: 0,
      apple: { linked: false, canUnlink: false },
    });
    await pg.query(
      `insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
       values ('acc-apple', '001.apple', 'apple', 'dana', now(), now())`,
    );
    // Apple is the only account: it cannot be unlinked yet
    expect((await signInMethods("dana")).apple).toEqual({ linked: true, canUnlink: false });
    await pg.query(
      `insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
       values ('acc-pass', 'dana', 'credential', 'dana', 'hash', now(), now())`,
    );
    expect(await signInMethods("dana")).toMatchObject({
      password: true,
      apple: { linked: true, canUnlink: true },
    });
  });
});
