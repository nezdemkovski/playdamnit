import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import { Client } from "pg";
import { ContentKind, ReportReason, ReportStatus } from "@playdamnit/db/enums";

const url = process.env.TEST_POSTGRES_URL;
describe.skipIf(!url)("moderation boundaries", () => {
  let pg: Client;
  let safety: typeof import("@/modules/moderation/service").ModerationService;
  let users: typeof import("@/modules/user/service").UserService;
  let reviews: typeof import("@/modules/review/service").ReviewService;
  let lists: typeof import("@/modules/list/service").ListService;
  let reviewId: string, listId: string;
  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(url!);
    pg = new Client(url);
    await pg.connect();
    await pg.query('truncate "user", game cascade');
    await pg.query(
      `insert into game (id, name, slug) values (990001, 'Safety Quest', 'safety-quest')`,
    );
    for (const id of ["reader", "author", "third", "moderator"])
      await pg.query(
        `insert into "user" (id,name,email,username,role) values ($1,$1,$1 || '@example.test',$1,$2)`,
        [id, id === "moderator" ? "admin" : "user"],
      );
    reviewId = (
      await pg.query(
        `insert into user_games (user_id,game_id,status,review) values ('author',990001,'finished','A normal review') returning id`,
      )
    ).rows[0].id;
    listId = (
      await pg.query(
        `insert into game_list (user_id,name,is_public) values ('author','Favourites',true) returning id`,
      )
    ).rows[0].id;
    ({ ModerationService: safety } = await import("@/modules/moderation/service"));
    ({ UserService: users } = await import("@/modules/user/service"));
    ({ ReviewService: reviews } = await import("@/modules/review/service"));
    ({ ListService: lists } = await import("@/modules/list/service"));
  });
  afterAll(async () => {
    await pg?.end();
  });
  test("report is private, deduplicated, and never auto-hides content", async () => {
    const input = { kind: ContentKind.Review, targetId: reviewId, reason: ReportReason.Abuse };
    await safety.report("reader", input);
    await safety.report("reader", input);
    expect((await safety.queue("moderator")).length).toBe(1);
    await expect(safety.queue("reader")).rejects.toThrow();
    expect((await reviews.list({ viewerId: "reader", limit: 10, offset: 0 })).results.length).toBe(
      1,
    );
    await expect(safety.report("author", input)).rejects.toThrow();
  });
  test("block is bilateral, preserves third-party visibility, and removes follows", async () => {
    await users.follow("reader", "author");
    await users.follow("author", "reader");
    await safety.block("reader", "author");
    expect((await safety.blocks("reader")).map((x) => x.id)).toEqual(["author"]);
    expect((await reviews.list({ viewerId: "reader", limit: 10, offset: 0 })).results.length).toBe(
      0,
    );
    expect((await reviews.list({ viewerId: "third", limit: 10, offset: 0 })).results.length).toBe(
      1,
    );
    await expect(users.findByUsername("author", "reader")).rejects.toThrow();
    await expect(users.findByUsername("reader", "author")).rejects.toThrow();
    await expect(lists.get(listId, "reader")).rejects.toThrow();
    expect((await lists.get(listId, "third")).name).toBe("Favourites");
    await expect(users.follow("author", "reader")).rejects.toThrow();
    expect((await users.notifications("reader", { limit: 10 })).results.length).toBe(0);
    expect((await pg.query("select * from user_follows")).rows.length).toBe(0);
    await safety.unblock("reader", "author");
    expect((await reviews.list({ viewerId: "reader", limit: 10, offset: 0 })).results.length).toBe(
      1,
    );
  });
  test("unblocking cannot bypass list privacy", async () => {
    await pg.query(`update "user" set list_public=false where id='author'`);
    expect((await reviews.list({ viewerId: "third", limit: 10, offset: 0 })).results.length).toBe(
      0,
    );
    expect((await reviews.list({ viewerId: "author", limit: 10, offset: 0 })).results.length).toBe(
      1,
    );
    await pg.query(`update "user" set list_public=true where id='author'`);
  });
  test("only a moderator can remove a review, preserving its library entry", async () => {
    const report = (await safety.queue("moderator"))[0]!;
    await expect(safety.resolve("reader", report.id, ReportStatus.Removed)).rejects.toThrow();
    await safety.resolve("moderator", report.id, ReportStatus.Removed);
    expect((await reviews.list({ viewerId: "third", limit: 10, offset: 0 })).results.length).toBe(
      0,
    );
    expect(
      (await pg.query("select review from user_games where id=$1", [reviewId])).rows[0].review,
    ).toBeNull();
    expect((await safety.queue("moderator")).length).toBe(0);
  });
  test("moderator suspension immediately revokes a previously authenticated session", async () => {
    const { auth } = await import("@/lib/auth");
    const { betterAuth } = await import("@/lib/betterAuth");
    const { Elysia } = await import("elysia");
    await auth.api.signUpEmail({
      body: {
        email: "suspend@example.test",
        password: "test-password-123",
        name: "Suspension test",
      },
    });
    await pg.query(`update "user" set email_verified=true where email='suspend@example.test'`);
    const login = await auth.api.signInEmail({
      body: { email: "suspend@example.test", password: "test-password-123" },
      asResponse: true,
    });
    const headers = new Headers({
      cookie: login.headers
        .getSetCookie()
        .map((x) => x.split(";")[0])
        .join("; "),
    });
    const subjectId = (await pg.query(`select id from "user" where email='suspend@example.test'`))
      .rows[0].id;
    const app = new Elysia()
      .use(betterAuth)
      .get("/protected", { auth: true }, ({ user }) => ({ id: user.id }));
    expect((await app.handle(new Request("http://localhost/protected", { headers }))).status).toBe(
      200,
    );
    await safety.report("reader", {
      kind: ContentKind.User,
      targetId: subjectId,
      reason: ReportReason.Spam,
    });
    const report = (await safety.queue("moderator")).find((x) => x.subjectId === subjectId)!;
    await safety.resolve("moderator", report.id, ReportStatus.Banned);
    expect((await pg.query("select id from session where user_id=$1", [subjectId])).rowCount).toBe(
      0,
    );
    expect((await app.handle(new Request("http://localhost/protected", { headers }))).status).toBe(
      401,
    );
    const { requireVisibleAuthor } = await import("@/modules/moderation/visibility");
    await expect(requireVisibleAuthor(subjectId, "third")).rejects.toThrow();
  });
  test("history and suspension management are private; restoring does not revive sessions", async () => {
    await expect(safety.queue("reader", true)).rejects.toThrow();
    await expect(safety.suspended("reader")).rejects.toThrow();
    const history = await safety.queue("moderator", true);
    expect(history.length).toBe(2);
    expect(history.every((report) => report.resolver?.id === "moderator")).toBe(true);
    const subject = (await safety.suspended("moderator"))[0]!;
    expect(subject.name).toBe("Suspension test");
    await expect(safety.restore("reader", subject.id)).rejects.toThrow();
    await safety.restore("moderator", subject.id);
    expect(await safety.suspended("moderator")).toEqual([]);
    expect((await pg.query("select id from session where user_id=$1", [subject.id])).rowCount).toBe(
      0,
    );
    const { requireVisibleAuthor } = await import("@/modules/moderation/visibility");
    await expect(requireVisibleAuthor(subject.id, "third")).resolves.toBeUndefined();
  });
  test("report pages retain snapshots and enforce the current moderator role", async () => {
    await safety.report("reader", {
      kind: ContentKind.User,
      targetId: "author",
      reason: ReportReason.Spam,
    });
    await safety.report("reader", {
      kind: ContentKind.User,
      targetId: "third",
      reason: ReportReason.Spam,
    });
    const queue = await safety.queue("moderator");
    expect(queue.length).toBe(2);
    expect(queue[0]!.reporter?.username).toBe("reader");
    expect(await safety.queue("moderator", false, 1)).toEqual(queue.slice(1));
    const history = await safety.queue("moderator", true);
    expect(history.find((report) => report.kind === ContentKind.Review)?.context).toBe(
      "A normal review",
    );
    await pg.query(`update "user" set role='user' where id='moderator'`);
    await expect(safety.queue("moderator")).rejects.toThrow();
    await expect(safety.restore("moderator", "author")).rejects.toThrow();
    await pg.query(`update "user" set role='admin' where id='moderator'`);
  });
});
