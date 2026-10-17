// Integration test for the shared read-only demo account: the session the API hands out, the
// writes it refuses (own routes and Better Auth's), and the lists it stays out of.
//   TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "pg";
import { Elysia } from "elysia";
import { UserGameStatus } from "@playdamnit/db/enums";
import { ApiErrorCode, ConnectionKind, HttpHeader, HttpMethod, MimeType } from "@/utils/enums";

const TEST_URL = process.env.TEST_POSTGRES_URL;
// Set by tests/setup.ts
const DEMO_USERNAME = process.env.DEMO_USERNAME!;
const ORIGIN = process.env.BETTER_AUTH_URL!;

describe.skipIf(!TEST_URL)("demo account (integration)", () => {
  let pg: Client;
  let app: { handle: (request: Request) => Promise<Response> };
  let auth: typeof import("@/lib/auth").auth;
  let DemoService: typeof import("@/modules/demo/service").DemoService;
  let TasteService: typeof import("@/modules/taste/service").TasteService;
  let UserService: typeof import("@/modules/user/service").UserService;
  let demoId: string;
  /** The cookie jar of one client: what the API set last, cleared ones dropped */
  let cookie = "";
  const jar = new Map<string, string>();
  const keep = (res: Response) => {
    for (const header of res.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(";");
      const [name, value] = pair.split("=");
      const cleared = attributes.some((a) => a.trim().toLowerCase() === "max-age=0") || !value;
      if (cleared) jar.delete(name.trim());
      else jar.set(name.trim(), value);
    }
    cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  };

  const GAMES = [950001, 950002, 950003];

  const call = (method: HttpMethod, path: string, body?: unknown) =>
    app.handle(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: {
          [HttpHeader.ContentType]: MimeType.Json,
          [HttpHeader.Origin]: ORIGIN,
          cookie,
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      }),
    );

  const callAuth = (path: string, body: unknown = {}) =>
    auth.handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: HttpMethod.Post,
        headers: {
          [HttpHeader.ContentType]: MimeType.Json,
          [HttpHeader.Origin]: ORIGIN,
          cookie,
        },
        body: JSON.stringify(body),
      }),
    );

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(TEST_URL!);
    pg = new Client(TEST_URL);
    await pg.connect();
    await pg.query(`truncate "user", game cascade`);
    await pg.query(
      `insert into platform (id, name, slug) values (6, 'PC', 'win') on conflict do nothing`,
    );
    for (const id of GAMES) {
      await pg.query(
        `insert into game (id, name, slug, total_rating_count, first_release_date) values ($1, $2, $3, 100, 1600000000)`,
        [id, `Demo Quest ${id}`, `demo-quest-${id}`],
      );
    }
    for (const u of ["mia", "noah"]) {
      await pg.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at, username)
         values ($1, $2, $3, true, now(), now(), $1)`,
        [u, u.toUpperCase(), `${u}@example.com`],
      );
    }

    ({ auth } = await import("@/lib/auth"));
    ({ DemoService } = await import("@/modules/demo/service"));
    ({ TasteService } = await import("@/modules/taste/service"));
    ({ UserService } = await import("@/modules/user/service"));
    const { betterAuth } = await import("@/lib/betterAuth");
    const { demoRoutes } = await import("@/routes/demo/session");
    const { meRoutes } = await import("@/routes/me");
    const { userSocialRoutes } = await import("@/routes/user/[username]/social");
    app = new Elysia()
      .use(betterAuth)
      .group("/api", (api) => api.use(demoRoutes).use(meRoutes).use(userSocialRoutes));

    ({ id: demoId } = await DemoService.ensureAccount({ email: "demo@example.com", name: "Demo" }));
    // The same grades as mia on three games: enough for a taste match, were it not the demo
    for (const [username, ids] of [
      ["mia", GAMES],
      ["noah", GAMES],
      [DEMO_USERNAME, GAMES],
    ] as const) {
      for (const id of ids) {
        await pg.query(
          `insert into user_games (user_id, game_id, status, rating, platform_id)
           select id, $2, $3, 8, 6 from "user" where username = $1`,
          [username, id, UserGameStatus.Finished],
        );
      }
    }
    // The demo follows mia, so its feed has life; mia must not see it among her followers
    await pg.query(`insert into user_follows (follower_id, following_id) values ($1, 'mia')`, [
      demoId,
    ]);
  });

  afterAll(async () => {
    await pg?.end();
  });

  test("makes the account once: read only, private, confirmed", async () => {
    const again = await DemoService.ensureAccount({ email: "demo@example.com", name: "Demo" });
    expect(again).toEqual({ id: demoId, created: false });
    // Unlocked (a plain member while its library is filled), it is still the demo's to update
    await DemoService.setLocked(false);
    expect(
      (await pg.query(`select role from "user" where id = $1`, [demoId])).rows[0].role,
    ).toBeNull();
    await DemoService.setLocked(true);
    const { rows } = await pg.query(
      `select role, list_public, email_verified from "user" where id = $1`,
      [demoId],
    );
    expect(rows[0]).toEqual({ role: "demo", list_public: false, email_verified: true });
  });

  test("hands out a day-long session of the demo account", async () => {
    const res = await call(HttpMethod.Post, "/api/demo/session");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.getSetCookie().length).toBeGreaterThan(0);
    keep(res);

    const me = await call(HttpMethod.Get, "/api/me");
    expect(me.status).toBe(200);
    const body = (await me.json()) as { id: string; demo: boolean };
    expect(body.id).toBe(demoId);
    expect(body.demo).toBe(true);

    // Measured against this clock, which set it: the database's may drift (a container's does)
    const { rows } = await pg.query(`select expires_at from session where user_id = $1`, [demoId]);
    const seconds = (new Date(rows[0].expires_at).getTime() - Date.now()) / 1000;
    expect(seconds).toBeLessThanOrEqual(24 * 60 * 60);
    expect(seconds).toBeGreaterThan(23 * 60 * 60);
  });

  test("refuses every write of the API with DEMO_READ_ONLY, and still reads", async () => {
    const patch = await call(HttpMethod.Patch, "/api/me", { bio: "changed" });
    expect(patch.status).toBe(403);
    expect(await patch.json()).toMatchObject({
      error: "Forbidden",
      code: ApiErrorCode.DemoReadOnly,
    });

    const follow = await call(HttpMethod.Post, "/api/user/noah/follow");
    expect(follow.status).toBe(403);

    const read = await call(HttpMethod.Post, "/api/me/notifications/read");
    expect(read.status).toBe(403);

    const feed = await call(HttpMethod.Get, "/api/me/feed");
    expect(feed.status).toBe(200);
    const { rows } = await pg.query(`select bio from "user" where id = $1`, [demoId]);
    expect(rows[0].bio).toBeNull();
  });

  test("refuses Better Auth's account changes, and lets the demo leave", async () => {
    const rename = await callAuth("/update-user", { name: "Not a demo" });
    expect(rename.status).toBe(403);
    expect(await rename.json()).toMatchObject({ code: ApiErrorCode.DemoReadOnly });

    const password = await callAuth("/change-password", {
      currentPassword: process.env.DEMO_PASSWORD,
      newPassword: "another-password-123",
    });
    expect(password.status).toBe(403);

    const { rows } = await pg.query(`select name from "user" where id = $1`, [demoId]);
    expect(rows[0].name).toBe("Demo");

    const out = await callAuth("/sign-out");
    expect(out.status).toBe(200);
    keep(out);
    const after = await call(HttpMethod.Get, "/api/me");
    expect(after.status).toBe(401);
  });

  test("is nobody's to see, follow or match", async () => {
    const search = await UserService.search({ limit: 50, offset: 0, viewerId: "mia" });
    expect(search.results.map((u) => u.username).toSorted()).toEqual(["mia", "noah"]);
    expect(search.meta.total).toBe(2);

    await expect(UserService.findByUsername(DEMO_USERNAME, "mia")).rejects.toThrow(
      "User not found",
    );
    const own = await UserService.findByUsername(DEMO_USERNAME, demoId);
    expect(own.id).toBe(demoId);

    await expect(UserService.follow("mia", DEMO_USERNAME)).rejects.toThrow("User not found");

    // Its own library, overview and journal read as any member's do; to others they are not there
    const { UserGameService } = await import("@/modules/userGame/service");
    const mine = await UserGameService.getUserGames(DEMO_USERNAME, { viewerId: demoId });
    expect(mine.results.length).toBe(GAMES.length);
    expect((await UserGameService.getOverview(DEMO_USERNAME, demoId)).private).toBeFalsy();
    expect((await UserService.journal(DEMO_USERNAME, demoId, {})).private).toBeFalsy();
    await expect(UserGameService.getUserGames(DEMO_USERNAME, { viewerId: "mia" })).rejects.toThrow(
      "User not found",
    );

    const followers = await UserService.connections("mia", ConnectionKind.Followers, {
      limit: 50,
      offset: 0,
      viewerId: "mia",
    });
    expect(followers.results).toEqual([]);
    expect(followers.meta.total).toBe(0);

    const matches = await TasteService.matches("mia", 10);
    expect(matches.results.map((m) => m.username)).toEqual(["noah"]);
  });
});
