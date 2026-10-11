// Integration tests for the backend ⇄ librarian contract (pg-boss + LISTEN/NOTIFY),
// with an in-process fake librarian. Needs a disposable database:
//   TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PgBoss } from "pg-boss";
import { Client } from "pg";
import { createAgentUIStreamResponse } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const TEST_URL = process.env.TEST_POSTGRES_URL;

describe.skipIf(!TEST_URL)("catalog requests (integration)", () => {
  let fakeLibrarian: PgBoss;
  let pg: Client;
  let mod: {
    searchGames: typeof import("@/utils/searchGames").searchGames;
    GameService: typeof import("@/modules/game/service").GameService;
    UserGameService: typeof import("@/modules/userGame/service").UserGameService;
    notify: typeof import("@/utils/pgNotify");
    stopBoss: typeof import("@/utils/pgBoss").stopBoss;
  };

  // Mirrors what the librarian writes: search_names is the name plus alternative names
  const insertGame = (
    id: number,
    name: string,
    extra: {
      gameType?: number;
      alternativeNames?: string[];
      versionParentId?: number;
      parentGameId?: number;
      deletedAt?: string;
    } = {},
  ) =>
    pg.query(
      `insert into game (id, name, slug, game_type, alternative_names, search_names, version_parent_id, parent_game_id, deleted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict do nothing`,
      [
        id,
        name,
        `${name.toLowerCase().replace(/\W+/g, "-")}-${id}`,
        extra.gameType ?? 0,
        extra.alternativeNames ?? [],
        [name, ...(extra.alternativeNames ?? [])].join(" "),
        extra.versionParentId ?? null,
        extra.parentGameId ?? null,
        extra.deletedAt ?? null,
      ],
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
    for (const name of ["search-igdb", "fetch-by-ids"]) {
      await fakeLibrarian.createQueue(name);
    }
    await fakeLibrarian.work<{ query: string; requestId: string }>(
      "search-igdb",
      { pollingIntervalSeconds: 0.5 },
      async ([job]) => {
        if (job.data.query.toLowerCase().includes("zzyzx")) await insertGame(900001, "Zzyzx Quest");
        await notify(job.data.requestId, true);
      },
    );
    await fakeLibrarian.work<{ ids: number[]; requestId?: string }>(
      "fetch-by-ids",
      { pollingIntervalSeconds: 0.5 },
      async ([job]) => {
        for (const id of job.data.ids.filter((id) => id < 950000))
          await insertGame(id, `Game ${id}`);
        if (job.data.requestId) await notify(job.data.requestId, true);
      },
    );

    mod = {
      searchGames: (await import("@/utils/searchGames")).searchGames,
      GameService: (await import("@/modules/game/service")).GameService,
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
    const first = await mod.searchGames("Zzyzx");
    expect(first.meta.source).toBe("igdb");
    expect(first.results.map((g) => g.name)).toEqual(["Zzyzx Quest"]);

    const second = await mod.searchGames("Zzyzx");
    expect(second.meta.source).toBe("database");
    expect(second.results.map((g) => g.name)).toEqual(["Zzyzx Quest"]);
  }, 15_000);

  test("LIKE wildcards in the query are matched literally", async () => {
    const result = await mod.searchGames("%");
    expect(result.results).toEqual([]);
  }, 15_000);

  test("search matches alternative names, hides deleted games and editions", async () => {
    await insertGame(900010, "Nightwalk", { alternativeNames: ["Ночная прогулка"] });
    await insertGame(900011, "Nightwalk: Deluxe Edition", { versionParentId: 900010 });
    await insertGame(900012, "Nightwalk Remastered", { gameType: 9, deletedAt: "2026-01-01" });
    await insertGame(900013, "Nightwalk: Shadows", { gameType: 1, parentGameId: 900010 });

    const names = async (q: string, opts = {}) =>
      (await mod.searchGames(q, opts)).results.map((g) => g.name).sort();

    expect(await names("Ночная")).toEqual(["Nightwalk"]);
    expect(await names("Nightwalk")).toEqual(["Nightwalk", "Nightwalk: Shadows"]);
    expect(await names("Nightwalk", { includeEditions: true })).toEqual([
      "Nightwalk",
      "Nightwalk: Deluxe Edition",
      "Nightwalk: Shadows",
    ]);
    expect(await names("Nightwalk", { gameTypes: [1] })).toEqual(["Nightwalk: Shadows"]);
  }, 15_000);

  test("the detail view adds companies, relatives and the deleted flag", async () => {
    await pg.query(
      `insert into company (id, name, slug) values (900100, 'Night Studio', 'night-studio') on conflict do nothing`,
    );
    await pg.query(
      `insert into game_to_company (game_id, company_id, developer, publisher) values (900010, 900100, true, true) on conflict do nothing`,
    );
    await pg.query(
      `insert into video (id, game_id, name, video_id) values (900200, 900010, 'Trailer', 'abc123') on conflict do nothing`,
    );

    const detail = await mod.GameService.findById(900010);
    expect(detail.developers.map((c) => c.name)).toEqual(["Night Studio"]);
    expect(detail.publishers.map((c) => c.name)).toEqual(["Night Studio"]);
    expect(detail.videos[0]).toMatchObject({
      videoId: "abc123",
      url: "https://www.youtube.com/watch?v=abc123",
    });
    expect(detail.children.map((g) => g.name)).toEqual(["Nightwalk: Shadows"]);
    expect(detail.editions.map((g) => g.name)).toEqual(["Nightwalk: Deluxe Edition"]);
    expect(detail.alternativeNames).toEqual(["Ночная прогулка"]);
    expect(detail.deleted).toBe(false);
    expect((detail as Record<string, unknown>).raw).toBeUndefined();

    expect((await mod.GameService.findById(900012)).deleted).toBe(true);
  }, 15_000);

  test("import fetches missing games and reports the ones IGDB doesn't have", async () => {
    await pg.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at, username)
       values ('u1', 'U', 'u@example.com', true, now(), now(), 'u1')`,
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
  test("the chat agent searches, streams full cards to the UI and a compact list to the model", async () => {
    // A DLC next to the main game, to exercise the "games only" filter
    await insertGame(900002, "Zzyzx Quest Expansion", { gameType: 1 });
    // Lookup ids are IGDB ids (1 = DLC)
    await pg.query(
      `insert into type (id, type) values (1, 'DLC') on conflict (id) do update set type = excluded.type`,
    );
    await pg.query(`insert into game_to_type (game_id, type_id) values (900002, 1)`);

    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    };
    const model = new MockLanguageModelV4({
      doStream: [
        {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "search_games",
                input: JSON.stringify({ query: "Zzyzx", rating: 8, status: "finished" }),
              });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "tool-calls", raw: undefined },
                usage,
              });
              controller.close();
            },
          }),
        },
        {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "text-start", id: "t1" });
              controller.enqueue({ type: "text-delta", id: "t1", delta: "Found Zzyzx Quest!" });
              controller.enqueue({ type: "text-end", id: "t1" });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage,
              });
              controller.close();
            },
          }),
        },
      ],
    });

    const { createChatAgent } = await import("@/modules/chat/agent");
    const response = await createAgentUIStreamResponse({
      agent: createChatAgent(model),
      uiMessages: [
        { id: "m1", role: "user", parts: [{ type: "text", text: "Finished Zzyzx, 8/10" }] },
      ],
      options: { showOnlyGames: true },
    });

    // SSE: one JSON UI message chunk per `data:` line
    const chunks = (await response.text())
      .split("\n")
      .filter((line) => line.startsWith("data: {"))
      .map((line) => JSON.parse(line.slice("data: ".length)));

    const toolOutput = chunks.find((c) => c.type === "tool-output-available");
    expect(toolOutput.output.results.map((g: { name: string }) => g.name)).toEqual(["Zzyzx Quest"]);
    expect(toolOutput.output.userRating).toBe(8);
    expect(toolOutput.output.userStatus).toBe("finished");
    expect(chunks.some((c) => c.type === "text-delta" && c.delta === "Found Zzyzx Quest!")).toBe(
      true,
    );

    // The second step saw the compact tool result, not the full cards
    const toolMessage = model.doStreamCalls[1].prompt.find((m) => m.role === "tool");
    expect(JSON.stringify(toolMessage)).toContain('"name":"Zzyzx Quest"');
    expect(JSON.stringify(toolMessage)).not.toContain("platforms");
  }, 30_000);
});
