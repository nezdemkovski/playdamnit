// Integration test for the social layer: follows, reviews and likes, lists, playthroughs,
// list privacy and community stats. Needs a disposable database:
//   TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "pg";
import { NotificationType, ReactionEmoji, UserGameStatus } from "@playdamnit/db/enums";
import { ConnectionKind, GameSort, ReviewSort, SteamConnectResult, UserSort } from "@/utils/enums";

const TEST_URL = process.env.TEST_POSTGRES_URL;

describe.skipIf(!TEST_URL)("social features (integration)", () => {
  let pg: Client;
  let GameService: typeof import("@/modules/game/service").GameService;
  let HomeService: typeof import("@/modules/home/service").HomeService;
  let ReviewService: typeof import("@/modules/review/service").ReviewService;
  let ListService: typeof import("@/modules/list/service").ListService;
  let UserService: typeof import("@/modules/user/service").UserService;
  let UserGameService: typeof import("@/modules/userGame/service").UserGameService;

  const GAME = 930001;
  const OTHER_GAME = 930002;

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(TEST_URL!);
    pg = new Client(TEST_URL);
    await pg.connect();
    await pg.query(`truncate "user", game cascade`);
    await pg.query(
      `insert into platform (id, name, slug) values (6, 'PC', 'win') on conflict do nothing`,
    );
    for (const [id, name] of [
      [GAME, "Social Quest"],
      [OTHER_GAME, "Social Quest II"],
    ] as const) {
      await pg.query(
        `insert into game (id, name, slug, total_rating_count, first_release_date) values ($1, $2, $3, 100, 1600000000)`,
        [id, name, `${name.toLowerCase().replace(/\s+/g, "-")}-${id}`],
      );
      await pg.query(`insert into cover (id, game_id, hash) values ($1, $2, 'co1234')`, [
        id + 1000,
        id,
      ]);
    }
    for (const u of ["alice", "bob", "carol"]) {
      await pg.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at, username)
         values ($1, $2, $3, true, now(), now(), $1)`,
        [u, u.toUpperCase(), `${u}@example.com`],
      );
    }
    ({ GameService } = await import("@/modules/game/service"));
    ({ HomeService } = await import("@/modules/home/service"));
    ({ ReviewService } = await import("@/modules/review/service"));
    ({ ListService } = await import("@/modules/list/service"));
    ({ UserService } = await import("@/modules/user/service"));
    ({ UserGameService } = await import("@/modules/userGame/service"));

    await UserGameService.addUserGame("alice", GAME, {
      status: UserGameStatus.Finished,
      rating: 9,
      review: "A **great** game.",
      platformId: 6,
      endedAt: "2025-04-21",
      mastered: true,
      spoilers: true,
    });
    await UserGameService.addUserGame("bob", GAME, {
      status: UserGameStatus.Playing,
      rating: 6,
      platformId: 6,
    });
    await UserGameService.addUserGame("carol", GAME, {
      status: UserGameStatus.WantToPlay,
      rating: 0,
      platformId: 6,
    });
  });

  afterAll(async () => {
    await pg?.end();
  });

  test("the game detail carries community stats, likes and the viewer's like", async () => {
    await GameService.like("bob", GAME);
    const detail = await GameService.findById(GAME, "bob");
    expect(detail.community.total).toBe(3);
    expect(detail.community.statuses.finished).toBe(1);
    expect(detail.community.statuses.want_to_play).toBe(1);
    expect(detail.community.mastered).toBe(1);
    expect(detail.community.ratingCount).toBe(2);
    expect(detail.community.ratingAverage).toBe(7.5);
    expect(detail.community.histogram[8]).toBe(1);
    expect(detail.community.histogram[5]).toBe(1);
    expect(detail.community.reviews).toBe(1);
    expect(detail.community.likes).toBe(1);
    expect(detail.viewer.liked).toBe(true);
    expect((await GameService.findById(GAME, "alice")).viewer.liked).toBe(false);
  });

  test("reviews carry emoji reactions, sort by top and notify the author", async () => {
    const before = await ReviewService.list({
      gameId: GAME,
      viewerId: "bob",
      limit: 10,
      offset: 0,
    });
    expect(before.results).toHaveLength(1);
    const review = before.results[0];
    expect(review.user.username).toBe("alice");
    expect(review.spoilers).toBe(true);
    expect(review.mastered).toBe(true);
    expect(review.likes).toBe(0);
    expect(review.reactions).toEqual([]);
    expect(review.myReaction).toBeNull();

    await ReviewService.react("bob", review.id, "🔥");
    await ReviewService.react("bob", review.id, ReactionEmoji.Clap); // a second emoji replaces the first
    await ReviewService.react("alice", review.id, ReactionEmoji.Clap); // reacting to yourself makes no notification
    await ReviewService.react("carol", review.id, ReactionEmoji.Heart);
    await expect(ReviewService.react("carol", review.id, "🦄")).rejects.toThrow(/Unknown reaction/);
    const after = await ReviewService.list({
      gameId: GAME,
      viewerId: "bob",
      sort: ReviewSort.Top,
      limit: 10,
      offset: 0,
    });
    expect(after.results[0].likes).toBe(3);
    expect(after.results[0].reactions).toEqual([
      { emoji: ReactionEmoji.Clap, count: 2 },
      { emoji: ReactionEmoji.Heart, count: 1 },
    ]);
    expect(after.results[0].myReaction).toBe("👏");

    const notifications = await UserService.notifications("alice", { limit: 10 });
    expect(notifications.unread).toBe(2);
    expect(notifications.results.map((n) => [n.type, n.actor.username, n.emoji]).sort()).toEqual([
      ["review_reaction", "bob", "👏"],
      ["review_reaction", "carol", "❤️"],
    ]);
    expect(notifications.results[0].game?.id).toBe(GAME);

    await ReviewService.unreact("bob", review.id);
    await ReviewService.unreact("carol", review.id);
    expect(
      (await ReviewService.list({ gameId: GAME, viewerId: null, limit: 10, offset: 0 })).results[0]
        .likes,
    ).toBe(1);

    // The author can turn reactions off
    await UserGameService.updateUserGame("alice", GAME, { allowReactions: false });
    await expect(ReviewService.react("bob", review.id, "🔥")).rejects.toThrow(
      /turned reactions off/,
    );
    await UserGameService.updateUserGame("alice", GAME, { allowReactions: true });
  });

  test("follow, connections, community search, feed and the follow notification", async () => {
    await UserService.follow("bob", "alice");
    await UserService.follow("carol", "alice");
    await expect(UserService.follow("alice", "alice")).rejects.toThrow();

    const profile = await UserService.findByUsername("alice", "bob");
    expect(profile.counts.followers).toBe(2);
    expect(profile.isFollowing).toBe(true);
    expect(profile.followsYou).toBe(false);

    const followers = await UserService.connections("alice", ConnectionKind.Followers, {
      limit: 10,
      offset: 0,
      viewerId: "bob",
    });
    expect(followers.results.map((u) => u.username).sort()).toEqual(["bob", "carol"]);

    const members = await UserService.search({
      q: "ali",
      sort: UserSort.Followers,
      limit: 10,
      offset: 0,
      viewerId: "bob",
    });
    expect(members.results).toHaveLength(1);
    expect(members.results[0]).toMatchObject({
      username: "alice",
      followersCount: 2,
      gamesCount: 1,
      isFollowing: true,
    });

    const feed = await UserService.feed("bob", { limit: 10, offset: 0 });
    expect(feed.results.map((i) => [i.user.username, i.game.id, i.status])).toEqual([
      ["alice", GAME, "finished"],
    ]);

    const notifications = await UserService.notifications("alice", { limit: 10 });
    expect(
      notifications.results
        .filter((n) => n.type === NotificationType.Follow)
        .map((n) => n.actor.username)
        .sort(),
    ).toEqual(["bob", "carol"]);
    await UserService.markNotificationsRead("alice");
    expect((await UserService.notifications("alice", { limit: 10 })).unread).toBe(0);

    await UserService.unfollow("carol", "alice");
    expect((await UserService.findByUsername("alice")).counts.followers).toBe(1);
  });

  test("lists are ordered, private ones are only the owner's, and membership is reported", async () => {
    const list = await ListService.create("alice", { name: "Favourites", description: "The best" });
    const secret = await ListService.create("alice", { name: "Secret", isPublic: false });
    await ListService.setGames(list.id, "alice", [OTHER_GAME, GAME]);
    await ListService.addGame(secret.id, "alice", GAME);
    await expect(ListService.addGame(list.id, "bob", GAME)).rejects.toThrow();
    await expect(ListService.setGames(list.id, "alice", [1])).rejects.toThrow(/Unknown games/);

    const detail = await ListService.get(list.id, null);
    expect(detail.games.map((g) => [g.id, g.position])).toEqual([
      [OTHER_GAME, 0],
      [GAME, 1],
    ]);
    expect(detail.covers).toHaveLength(2);

    expect((await ListService.forUser("alice", null)).map((l) => l.name)).toEqual(
      ["Secret", "Favourites"].filter((n) => n !== "Secret"),
    );
    expect((await ListService.forUser("alice", "alice")).map((l) => l.name).sort()).toEqual([
      "Favourites",
      "Secret",
    ]);
    await expect(ListService.get(secret.id, "bob")).rejects.toThrow();

    const membership = await ListService.membership("alice", GAME);
    expect(membership.map((m) => [m.name, m.contains]).sort()).toEqual([
      ["Favourites", true],
      ["Secret", true],
    ]);
    expect((await GameService.findById(GAME)).community.lists).toBe(1);

    await ListService.removeGame(list.id, "alice", GAME);
    expect((await ListService.get(list.id, null)).games.map((g) => g.id)).toEqual([OTHER_GAME]);
    await ListService.remove(list.id, "alice");
    await expect(ListService.get(list.id, "alice")).rejects.toThrow();
  });

  test("playthroughs feed the journal, which merges in finished entries", async () => {
    await UserGameService.addPlaythrough("alice", GAME, {
      startedAt: "2025-03-01",
      endedAt: "2025-04-21",
      hours: 40.5,
      platformId: 6,
    });
    await UserGameService.addPlaythrough("alice", GAME, {
      startedAt: "2026-01-05",
      endedAt: null,
      note: "NG+",
    });
    await expect(
      UserGameService.addPlaythrough("alice", GAME, { startedAt: "yesterday" }),
    ).rejects.toThrow(/YYYY-MM-DD/);
    await expect(UserGameService.addPlaythrough("alice", OTHER_GAME, {})).rejects.toThrow();

    const journal = await UserService.journal("alice", null, {});
    expect(journal.private).toBe(false);
    expect(journal.results.map((i) => [i.kind, i.date])).toEqual([
      ["playthrough", "2026-01-05"],
      ["playthrough", "2025-04-21"],
    ]);
    expect(journal.results[1].hours).toBe(40.5);
    expect((await UserService.journal("alice", null, { year: 2025 })).results).toHaveLength(1);

    // bob finished the other game without logging a playthrough: it shows up as an entry
    const added = await UserGameService.addUserGame("bob", OTHER_GAME, {
      status: UserGameStatus.Dropped,
      rating: 3,
      platformId: 6,
      endedAt: "2024-12-31",
    });
    // The answer carries the entry as the list serves it and the game's member numbers
    expect(added.entry?.id).toBe(OTHER_GAME);
    expect(added.entry?.userGameData.status).toBe(UserGameStatus.Dropped);
    expect(added.community.statuses[UserGameStatus.Dropped]).toBeGreaterThan(0);
    const bobs = await UserService.journal("bob", null, {});
    expect(bobs.results.map((i) => [i.kind, i.date, i.game.id])).toEqual([
      ["entry", "2024-12-31", OTHER_GAME],
    ]);
  });

  test("a private list hides the library, reviews, journal and feed from others", async () => {
    await UserService.updateProfile("alice", {
      listPublic: false,
      bio: "hi",
      links: ["https://example.com"],
    });
    expect((await UserService.findByUsername("alice")).listPublic).toBe(false);

    await expect(UserGameService.getUserGames("alice", { viewerId: "bob" })).rejects.toThrow(
      /private/,
    );
    await expect(UserGameService.getUserGames("alice", { viewerId: null })).rejects.toThrow(
      /private/,
    );
    expect((await UserGameService.getUserGames("alice", { viewerId: "alice" })).meta.total).toBe(1);

    expect(
      (await ReviewService.list({ gameId: GAME, viewerId: "bob", limit: 10, offset: 0 })).results,
    ).toHaveLength(0);
    expect(
      (await ReviewService.list({ gameId: GAME, viewerId: "alice", limit: 10, offset: 0 })).results,
    ).toHaveLength(1);
    expect((await UserService.journal("alice", "bob", {})).private).toBe(true);
    expect((await UserService.feed("bob", { limit: 10, offset: 0 })).results).toHaveLength(0);

    await expect(UserService.updateProfile("alice", { links: ["ftp://nope"] })).rejects.toThrow(
      /web link/,
    );
    await UserService.updateProfile("alice", { listPublic: true });
    expect(
      (await ReviewService.list({ gameId: GAME, viewerId: null, limit: 10, offset: 0 })).results,
    ).toHaveLength(1);
  });

  test("the home page comes in one answer, with the personal parts only for a member", async () => {
    const guest = await HomeService.load(null);
    expect(guest.feed).toBeNull();
    expect(guest.forYou).toBeNull();
    expect(Array.isArray(guest.trending)).toBe(true);
    const member = await HomeService.load("bob");
    expect(Array.isArray(member.feed)).toBe(true);
    expect(Array.isArray(member.forYou)).toBe(true);
  });

  test("the catalog browse honours filters and the member-based sorts", async () => {
    const wanted = await GameService.findGames({ sort: GameSort.Wanted, limit: 10 });
    expect(wanted.results[0].id).toBe(GAME);
    const played = await GameService.findGames({ sort: GameSort.Played, limit: 10 });
    expect(played.results.map((g) => g.id)).toEqual([GAME, OTHER_GAME]);
    // A page past the members' games continues with the rest of the catalog, without repeats
    const second = await GameService.findGames({ sort: GameSort.Wanted, limit: 1, offset: 1 });
    expect(second.results).toHaveLength(1);
    expect(second.results[0].id).not.toBe(GAME);
    expect((await GameService.findGames({ year: 2020, sort: GameSort.Date })).meta.total).toBe(2);
    expect((await GameService.findGames({ year: 2021 })).meta.total).toBe(0);
    expect(
      (await GameService.findGames({ ids: [OTHER_GAME, GAME] })).results.map((g) => g.id),
    ).toEqual([GAME, OTHER_GAME]);
    expect((await GameService.findGames({ platformId: 6 })).meta.total).toBe(0);
  });

  test("Steam playtime adds up per day for the activity map, within the last year", async () => {
    const { SteamService } = await import("@/modules/steam/service");
    await pg.query(
      `insert into steam_playtime (user_id, game_id, day, minutes) values
         ('alice', $1, current_date - 1, 90), ('alice', $2, current_date - 1, 30),
         ('alice', $1, current_date - 3, 45), ('alice', $1, current_date - 400, 600)`,
      [GAME, OTHER_GAME],
    );
    const { days } = await SteamService.activity("alice");
    expect(days.map((d) => d.minutes)).toEqual([45, 120]);
    expect(days[1].games.map((g) => [g.id, g.minutes])).toEqual([
      [GAME, 90],
      [OTHER_GAME, 30],
    ]);
    expect((await SteamService.activity("bob")).days).toEqual([]);
  });

  test("the release calendar counts per UTC day and can keep only popular games", async () => {
    // Both seeded games release at 1600000000 = 2020-09-13 12:26:40 UTC
    const range = { releasedFrom: 1598918400, releasedTo: 1601510399 }; // September 2020
    expect((await GameService.releaseDays(range)).days).toEqual([{ date: "2020-09-13", count: 2 }]);
    await pg.query(`update game set is_popular = true where id = $1`, [GAME]);
    expect((await GameService.releaseDays({ ...range, popular: true })).days).toEqual([
      { date: "2020-09-13", count: 1 },
    ]);
    const popular = await GameService.findGames({
      ...range,
      popular: true,
      sort: GameSort.Popular,
    });
    expect(popular.results.map((g) => g.id)).toEqual([GAME]);
    await pg.query(`update game set is_popular = false where id = $1`, [GAME]);
    // Follows before release make an unrated game hot too
    await pg.query(`update game set hypes = 25 where id = $1`, [OTHER_GAME]);
    expect((await GameService.releaseDays({ ...range, popular: true })).days).toEqual([
      { date: "2020-09-13", count: 1 },
    ]);
    await pg.query(`update game set hypes = null where id = $1`, [OTHER_GAME]);
  });

  test("recommendations follow liked games to their similar games, never to owned ones", async () => {
    const { RecommendationService } = await import("@/modules/recommendation/service");
    const ids = async (userId: string) =>
      (await RecommendationService.forUser(userId, 10)).results.map((g) => g.id);
    await pg.query(`update game set similar_game_ids = $2 where id = $1`, [GAME, [OTHER_GAME]]);
    // Graded S, and an ungraded wishlist entry (rating 0) still counts as a hint
    expect(await ids("alice")).toEqual([OTHER_GAME]);
    expect(await ids("carol")).toEqual([OTHER_GAME]);
    // Bob already has it
    expect(await ids("bob")).toEqual([]);
    // A low grade pushes the neighbours away
    await pg.query(`update user_games set rating = 2 where user_id = 'alice' and game_id = $1`, [
      GAME,
    ]);
    expect(await ids("alice")).toEqual([]);
    await pg.query(`update user_games set rating = 9 where user_id = 'alice' and game_id = $1`, [
      GAME,
    ]);
    await pg.query(`update game set similar_game_ids = '{}' where id = $1`, [GAME]);
  });

  test("connecting a proven Steam account moves it off anyone else and survives a private library", async () => {
    const { SteamService } = await import("@/modules/steam/service");
    const STEAM_ID = "76561199000000001";
    await pg.query(`update "user" set steam_id = $1, steam_name = 'old' where id = 'bob'`, [
      STEAM_ID,
    ]);
    const realFetch = globalThis.fetch;
    // Steam stubbed: the summary is public, the game details private
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.includes("GetPlayerSummaries")) {
        return Response.json({
          response: {
            players: [
              {
                personaname: "alice_on_steam",
                profileurl: "https://s/a",
                avatarmedium: "https://s/a.jpg",
              },
            ],
          },
        });
      }
      return Response.json({ response: {} });
    }) as unknown as typeof fetch;
    try {
      expect(await SteamService.connect("alice", STEAM_ID)).toBe(SteamConnectResult.Private);
    } finally {
      globalThis.fetch = realFetch;
    }
    const { rows } = await pg.query(
      `select id, steam_id, steam_name from "user" where id in ('alice', 'bob') order by id`,
    );
    expect(rows).toEqual([
      { id: "alice", steam_id: STEAM_ID, steam_name: "alice_on_steam" },
      { id: "bob", steam_id: null, steam_name: null },
    ]);
    await pg.query(
      `update "user" set steam_id = null, steam_name = null, steam_profile_url = null, steam_avatar_url = null where id = 'alice'`,
    );
  });
});
