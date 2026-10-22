// Integration test for the reads that save a thin client its own rules and extra requests: the
// catalog's rules, the entry page in one call, the viewer's entry on the game page and the
// release calendar's total. Needs a disposable database:
//   TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { Client } from "pg";
import { UserGameStatus } from "@playdamnit/db/enums";
import type { catalogRules } from "@/modules/catalog/rules";

const TEST_URL = process.env.TEST_POSTGRES_URL;

// Playthroughs logged in one transaction share a createdAt, so compare them in a fixed order
const byId = <T extends { id: string }>(rows: T[]) =>
  rows.toSorted((x, y) => x.id.localeCompare(y.id));

describe.skipIf(!TEST_URL)("game and entry pages (integration)", () => {
  let pg: Client;
  let GameService: typeof import("@/modules/game/service").GameService;
  let UserGameService: typeof import("@/modules/userGame/service").UserGameService;
  let ListService: typeof import("@/modules/list/service").ListService;

  const GAME = 950001;
  const OTHER = 950002;
  // 2030-01-01T00:00:00Z: a quiet stretch of the calendar the other tests leave alone
  const DAY = 1_893_456_000;

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(TEST_URL!);
    pg = new Client(TEST_URL);
    await pg.connect();
    await pg.query(`truncate "user", game cascade`);
    await pg.query(
      `insert into platform (id, name, slug) values (6, 'PC', 'win') on conflict do nothing`,
    );
    const releases: [number, number][] = [
      [GAME, DAY],
      [OTHER, DAY],
      [950003, DAY + 86_400],
      [950004, DAY + 3 * 86_400],
    ];
    for (const [id, date] of releases) {
      await pg.query(
        `insert into game (id, name, slug, first_release_date) values ($1, $2, $3, $4)`,
        [id, `Game ${id}`, `game-${id}`, date],
      );
    }
    for (const [u, listPublic] of [
      ["owner", true],
      ["guest", true],
    ] as const) {
      await pg.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at, username, list_public)
         values ($1, $1, $2, true, now(), now(), $1, $3)`,
        [u, `${u}@example.com`, listPublic],
      );
    }
    ({ GameService } = await import("@/modules/game/service"));
    ({ UserGameService } = await import("@/modules/userGame/service"));
    ({ ListService } = await import("@/modules/list/service"));

    await UserGameService.addUserGame("owner", GAME, {
      status: UserGameStatus.Finished,
      rating: 9,
      review: "Loved it",
      platformId: 6,
      endedAt: "2026-01-02",
      playthroughs: [
        { startedAt: "2025-12-01", endedAt: "2025-12-20", hours: 12, note: "First run" },
      ],
    });
    await UserGameService.addPlaythrough("owner", GAME, { hours: 3, note: "Second" });
    await UserGameService.addUserGame("owner", OTHER, { status: UserGameStatus.Backlog });
    const open = await ListService.create("owner", { name: "Open", isPublic: true });
    const closed = await ListService.create("owner", { name: "Closed", isPublic: false });
    const unrelated = await ListService.create("owner", { name: "Other", isPublic: true });
    await ListService.addGame(open.id, "owner", GAME);
    await ListService.addGame(closed.id, "owner", GAME);
    await ListService.addGame(unrelated.id, "owner", OTHER);
  });

  afterAll(async () => {
    await pg?.end();
  });

  test("the catalog serves the rules clients used to copy", async () => {
    const { getCatalogLookups } = await import("@/routes/catalog/GET");
    const { canGrade } = await import("@/modules/userGame/rules");
    const { MAX_REVIEW_LENGTH } = await import("@/modules/userGame/model");
    const res = await new Elysia()
      .use(getCatalogLookups)
      .handle(new Request("http://localhost/catalog"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReturnType<typeof catalogRules>;
    expect(body.gradableStatuses).toEqual(Object.values(UserGameStatus).filter(canGrade));
    expect(body.gradableStatuses).not.toContain(UserGameStatus.Backlog);
    expect(body.gradableStatuses).not.toContain(UserGameStatus.WantToPlay);
    expect(body.endedStatuses).toEqual([UserGameStatus.Finished, UserGameStatus.Dropped]);
    expect(body.chartYears).toEqual({ from: 1980, to: new Date().getUTCFullYear() + 1 });
    expect(body.limits).toEqual({
      bioLength: 300,
      profileLinks: 5,
      profileLinkLength: 200,
      reviewLength: MAX_REVIEW_LENGTH,
      playthroughNoteLength: 1000,
      listNameLength: 100,
      listDescriptionLength: 1000,
      passwordMinLength: 8,
      passwordMaxLength: 128,
    });
  });

  test("the served limits are the ones the routes validate with", async () => {
    const { listRoutes } = await import("@/routes/lists/index");
    const { textLimits } = await import("@/utils/limits");
    const limits = textLimits();
    const patch = listRoutes.routes.find(
      (r) => r.path === "/lists/:id" && r.method.toUpperCase() === "PATCH",
    );
    const schema = JSON.stringify(patch?.hooks?.body ?? {});
    expect(schema).toContain(`"maxLength":${limits.listNameLength}`);
    expect(schema).toContain(`"maxLength":${limits.listDescriptionLength}`);
  });

  test("the entry comes with its playthroughs and the lists the viewer can see", async () => {
    const own = await UserGameService.getEntry("owner", GAME, "owner");
    expect(own.userGameData.review).toBe("Loved it");
    expect(own.listCount).toBe(2);
    expect(own.playthroughs.map((p) => p.note)).toEqual(
      expect.arrayContaining(["Second", "First run"]),
    );
    expect(own.playthroughs.find((p) => p.note === "First run")!.hours).toBe(12);
    expect(byId(own.playthroughs)).toEqual(
      byId(await UserGameService.listPlaythroughs("owner", GAME, null)),
    );

    const guest = await UserGameService.getEntry("owner", GAME, "guest");
    expect(guest.listCount).toBe(1);
    expect((await UserGameService.getEntry("owner", GAME, null)).listCount).toBe(1);

    const bare = await UserGameService.getEntry("owner", OTHER, "owner");
    expect(bare.listCount).toBe(1);
    expect(bare.playthroughs).toEqual([]);
  });

  test("the game page carries the viewer's own entry, review included", async () => {
    const mine = await GameService.findById(GAME, "owner");
    expect(mine.viewer.entry).not.toBeNull();
    expect(mine.viewer.entry!.status).toBe(UserGameStatus.Finished);
    expect(mine.viewer.entry!.review).toBe("Loved it");
    expect(mine.viewer.entry).toEqual(
      (await UserGameService.getEntry("owner", GAME, "owner")).userGameData,
    );

    expect((await GameService.findById(GAME, "guest")).viewer.entry).toBeNull();
    expect((await GameService.findById(GAME, null)).viewer).toEqual({
      liked: false,
      entry: null,
    });
  });

  test("the release calendar counts the whole range", async () => {
    const range = await GameService.releaseDays({
      releasedFrom: DAY,
      releasedTo: DAY + 7 * 86_400 - 1,
    });
    expect(range.days.map((d) => d.count)).toEqual([2, 1, 1]);
    expect(range.total).toBe(4);

    const mine = await GameService.releaseDays({
      releasedFrom: DAY,
      releasedTo: DAY + 7 * 86_400 - 1,
      ownerId: "owner",
    });
    expect(mine.total).toBe(2);

    const empty = await GameService.releaseDays({ releasedFrom: 0, releasedTo: 1 });
    expect(empty).toEqual({ days: [], total: 0 });
  });
});
