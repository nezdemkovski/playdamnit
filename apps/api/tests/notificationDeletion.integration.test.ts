import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "pg";
import { Elysia, ValidationError } from "elysia";
import { HttpMethod } from "@/utils/enums";
import { NotificationType } from "@playdamnit/db/enums";

const url = process.env.TEST_POSTGRES_URL;
describe.skipIf(!url)("inbox deletion isolation and released reads", () => {
  let pg: Client;
  let app: { handle(request: Request): Promise<Response> };
  let owner: string;
  let other: string;
  let headers: Headers;
  const samples: Record<string, unknown> = {};

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(url!);
    pg = new Client(url);
    await pg.connect();
    await pg.query('truncate "user", game cascade');
    const { auth } = await import("@/lib/auth");
    for (const name of ["inbox-owner", "inbox-other"]) {
      await auth.api.signUpEmail({
        body: { email: `${name}@example.test`, password: "test-password-123", name },
      });
    }
    await pg.query('update "user" set email_verified=true');
    const login = await auth.api.signInEmail({
      body: { email: "inbox-owner@example.test", password: "test-password-123" },
      asResponse: true,
    });
    headers = new Headers({
      cookie: login.headers
        .getSetCookie()
        .map((x) => x.split(";")[0])
        .join("; "),
    });
    owner = (await pg.query('select id from "user" where email=$1', ["inbox-owner@example.test"]))
      .rows[0].id;
    other = (await pg.query('select id from "user" where email=$1', ["inbox-other@example.test"]))
      .rows[0].id;
    const { meRoutes } = await import("@/routes/me");
    app = new Elysia({ prefix: "/api" })
      .error(({ error, status }) => {
        if (error instanceof ValidationError)
          return status(400, { error: "Bad Request", message: "Invalid request" });
      })
      .use(meRoutes);
  });
  beforeEach(async () => {
    await pg.query("delete from notification");
  });
  afterAll(async () => {
    if (process.env.INBOX_COMPAT_OUTPUT)
      await Bun.write(process.env.INBOX_COMPAT_OUTPUT, JSON.stringify(samples));
    await pg?.end();
  });
  const request = (method: HttpMethod, path: string, authenticated = true) =>
    app.handle(
      new Request(`http://localhost/api/me/notifications${path}`, {
        method,
        headers: authenticated ? headers : undefined,
      }),
    );
  const insert = async (recipient: string, read = false) =>
    (
      await pg.query(
        "insert into notification(user_id,actor_id,type,read_at) values($1,$2,$3,$4) returning id",
        [
          recipient,
          recipient === owner ? other : owner,
          NotificationType.Follow,
          read ? new Date() : null,
        ],
      )
    ).rows[0].id as string;

  test("legacy list, limit, unread and mark-read still have their original shapes", async () => {
    await insert(owner);
    await insert(owner, true);
    const response = await request(HttpMethod.Get, "?limit=1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { results: unknown[]; unread: number };
    expect(body.results).toHaveLength(1);
    expect(body.unread).toBe(1);
    samples.populated = body;
    const unauthenticated = await request(HttpMethod.Get, "", false);
    expect(unauthenticated.status).toBe(401);
    samples.unauthorized = await unauthenticated.json();
    const read = await request(HttpMethod.Post, "/read");
    expect(read.status).toBe(200);
    samples.read = await read.json();
    expect(samples.read).toEqual({ ok: true });
    expect(await (await request(HttpMethod.Get, "/unread")).json()).toEqual({ unread: 0 });
  });

  test("one deletion is authenticated, owner scoped, idempotent, and updates unread", async () => {
    const mine = await insert(owner);
    const theirs = await insert(other);
    expect((await request(HttpMethod.Delete, `/${mine}`, false)).status).toBe(401);
    expect(await (await request(HttpMethod.Delete, `/${theirs}`)).json()).toEqual({
      ok: true,
      unread: 1,
    });
    expect((await pg.query("select id from notification where id=$1", [theirs])).rowCount).toBe(1);
    expect(await (await request(HttpMethod.Delete, `/${mine}`)).json()).toEqual({
      ok: true,
      unread: 0,
    });
    expect(await (await request(HttpMethod.Delete, `/${mine}`)).json()).toEqual({
      ok: true,
      unread: 0,
    });
    expect((await request(HttpMethod.Delete, "/not-a-uuid")).status).toBe(400);
  });

  test("clear deletes beyond the loaded page, including read notifications, and preserves other inboxes", async () => {
    for (let i = 0; i < 55; i++) await insert(owner, i % 2 === 0);
    const theirs = await insert(other);
    expect((await request(HttpMethod.Delete, "", false)).status).toBe(401);
    expect(await (await request(HttpMethod.Delete, "")).json()).toEqual({ ok: true, unread: 0 });
    expect(
      (await pg.query("select count(*)::int as n from notification where user_id=$1", [owner]))
        .rows[0].n,
    ).toBe(0);
    expect((await pg.query("select id from notification where id=$1", [theirs])).rowCount).toBe(1);
    samples.empty = await (await request(HttpMethod.Get, "?limit=50")).json();
    expect(samples.empty).toEqual({ results: [], unread: 0 });
    expect(await (await request(HttpMethod.Delete, "")).json()).toEqual({ ok: true, unread: 0 });
    // A later event starts a new inbox and is not suppressed by clearing earlier ones.
    await insert(owner);
    expect(
      ((await (await request(HttpMethod.Get, "")).json()) as { results: unknown[] }).results,
    ).toHaveLength(1);
  });
});
