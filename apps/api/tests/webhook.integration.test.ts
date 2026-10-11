// Integration test for the IGDB webhook receiver. Needs a disposable database:
//   TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "pg";
import { Elysia } from "elysia";
import { WebhookEntity, WebhookMethod } from "@playdamnit/db/enums";
import { HttpHeader, HttpMethod, MimeType } from "@/utils/enums";

const TEST_URL = process.env.TEST_POSTGRES_URL;
// Set by tests/setup.ts before any module reads the config
const SECRET = process.env.IGDB_WEBHOOK_SECRET!;

describe.skipIf(!TEST_URL)("IGDB webhook receiver (integration)", () => {
  let pg: Client;
  let app: { handle: (request: Request) => Promise<Response> };

  const post = (
    entity: WebhookEntity | string,
    method: WebhookMethod | string,
    body: unknown,
    secret: string | null = SECRET,
  ) =>
    app.handle(
      new Request(`http://localhost/webhooks/igdb/${entity}/${method}`, {
        method: HttpMethod.Post,
        headers: {
          [HttpHeader.ContentType]: MimeType.Json,
          ...(secret !== null && { [HttpHeader.Secret]: secret }),
        },
        body: JSON.stringify(body),
      }),
    );

  const dirty = async () =>
    (await pg.query(`select igdb_id, reason from catalog_dirty order by igdb_id`)).rows;

  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(TEST_URL!);

    pg = new Client(TEST_URL);
    await pg.connect();
    await pg.query(`truncate catalog_dirty, game cascade`);
    await pg.query(
      `insert into game (id, name, slug) values (910001, 'Hooked', 'hooked-910001') on conflict do nothing`,
    );
    await pg.query(
      `insert into cover (id, game_id, hash) values (910100, 910001, 'co0000') on conflict do nothing`,
    );

    const { postIgdbWebhook } = await import("@/routes/webhooks/igdb/POST");
    app = new Elysia().use(postIgdbWebhook);
  });

  afterAll(async () => {
    await pg?.end();
  });

  test("rejects a missing or wrong secret", async () => {
    expect(
      (await post(WebhookEntity.Games, WebhookMethod.Update, { id: 910001 }, null)).status,
    ).toBe(403);
    expect(
      (await post(WebhookEntity.Games, WebhookMethod.Update, { id: 910001 }, "nope")).status,
    ).toBe(403);
    expect(await dirty()).toEqual([]);
  });

  test("queues the game of an event, and a delete wins over an update", async () => {
    const res = await post(WebhookEntity.Games, WebhookMethod.Update, {
      id: 910001,
      name: "Hooked",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, gameId: 910001 });
    expect(await dirty()).toEqual([{ igdb_id: 910001, reason: "games:update" }]);

    await post(WebhookEntity.Games, WebhookMethod.Delete, { id: 910001 });
    expect(await dirty()).toEqual([{ igdb_id: 910001, reason: "deleted" }]);

    // Later non-delete events don't downgrade the reason
    await post(WebhookEntity.Games, WebhookMethod.Update, { id: 910001 });
    expect(await dirty()).toEqual([{ igdb_id: 910001, reason: "deleted" }]);
  });

  test("resolves child entities through the payload or the catalog", async () => {
    await pg.query(`truncate catalog_dirty`);

    // A new cover carries its game
    await post(WebhookEntity.Covers, WebhookMethod.Create, {
      id: 910101,
      game: 910002,
      image_id: "co1111",
    });
    // A deleted cover carries only its id: the cover row says which game it belonged to
    await post(WebhookEntity.Covers, WebhookMethod.Delete, { id: 910100 });
    // Nothing to resolve: acknowledged and ignored
    const res = await post(WebhookEntity.Covers, WebhookMethod.Delete, { id: 999999 });
    expect(await res.json()).toEqual({ ok: true, gameId: null });

    expect(await dirty()).toEqual([
      { igdb_id: 910001, reason: "covers:delete" },
      { igdb_id: 910002, reason: "covers:create" },
    ]);
  });

  test("validates entity, method and body", async () => {
    expect((await post("companies", WebhookMethod.Update, { id: 1 })).status).toBe(422);
    expect((await post(WebhookEntity.Games, "patch", { id: 1 })).status).toBe(422);
    expect((await post(WebhookEntity.Games, WebhookMethod.Update, [1, 2])).status).toBe(400);
  });
});
