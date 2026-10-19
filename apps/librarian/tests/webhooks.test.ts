import { afterEach, expect, test } from "bun:test";
import type { PgBoss } from "pg-boss";

import { WebhookEntity, WebhookMethod } from "@playdamnit/db/enums";
import { QUEUES } from "@playdamnit/db/jobs";
import { Schedule } from "@/utils/enums";
import { ensureWebhooks } from "@/utils/igdb/webhooks";
import { registerWebhookWorker } from "@/workers/webhookWorker";

const baseUrl = "https://example.test";
const secret = "test-webhook-secret";
const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const hooks = () =>
  Object.values(WebhookEntity).flatMap((entity, i) =>
    Object.values(WebhookMethod).map((method, j) => ({
      id: i * 3 + j + 1,
      url: `${baseUrl}/api/webhooks/igdb/${entity}/${method}`,
      active: true,
    })),
  );
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of [
    "WEBHOOK_BASE_URL",
    "IGDB_WEBHOOK_SECRET",
    "TWITCH_CLIENT_ID",
    "TWITCH_CLIENT_SECRET",
  ]) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function scriptFetch(responses: Response[]) {
  process.env.TWITCH_CLIENT_ID = "test";
  process.env.TWITCH_CLIENT_SECRET = "test";
  const calls: { url: string; method?: string; body?: RequestInit["body"] }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("id.twitch.tv")) return json({ access_token: "t", expires_in: 3600 });
    calls.push({ url, method: init?.method, body: init?.body });
    const response = responses.shift();
    if (!response) throw new Error(`Unexpected request: ${url}`);
    return response;
  }) as typeof fetch;
  return calls;
}

function fakeBoss() {
  let handler: (() => Promise<void>) | undefined;
  const calls: { method: string; args: unknown[] }[] = [];
  const boss = {
    async work(...args: unknown[]) {
      calls.push({ method: "work", args });
      handler = args[1] as () => Promise<void>;
    },
    async schedule(...args: unknown[]) {
      calls.push({ method: "schedule", args });
    },
    async unschedule(...args: unknown[]) {
      calls.push({ method: "unschedule", args });
    },
    async send(...args: unknown[]) {
      calls.push({ method: "send", args });
    },
  };
  return { boss: boss as unknown as PgBoss, calls, run: () => handler!() };
}

function configured() {
  process.env.WEBHOOK_BASE_URL = baseUrl;
  process.env.IGDB_WEBHOOK_SECRET = secret;
}

test("healthy subscriptions are untouched; periodic and startup jobs use the same check", async () => {
  configured();
  const calls = scriptFetch([json(hooks()), json(hooks())]);
  const worker = fakeBoss();
  await registerWebhookWorker(worker.boss);
  expect(worker.calls.find((c) => c.method === "schedule")?.args).toEqual([
    QUEUES.ENSURE_WEBHOOKS,
    Schedule.EnsureWebhooks,
  ]);
  expect(worker.calls.find((c) => c.method === "send")?.args[0]).toBe(QUEUES.ENSURE_WEBHOOKS);
  await worker.run();
  await worker.run();
  expect(calls.map((c) => c.method)).toEqual(["GET", "GET"]);
});

test("repairs a disabled subscription and a missing video subscription, then is idempotent", async () => {
  const current = hooks();
  const disabled = current.find((h) => h.url.endsWith("/games/update"))!;
  disabled.active = false;
  const missingUrl = `${baseUrl}/api/webhooks/igdb/videos/create`;
  const calls = scriptFetch([
    json(current.filter((h) => h.url !== missingUrl)),
    json({}),
    json({}),
    json({}),
    json(hooks()),
  ]);
  const result = await ensureWebhooks({ baseUrl: `${baseUrl}/`, secret });
  expect(result).toEqual({ existing: 23, active: 22, recreated: 1, created: 1, failed: 0 });
  expect(calls.map((c) => c.method)).toEqual(["GET", "DELETE", "POST", "POST"]);
  expect(calls[1]!.url).toEndWith(`/webhooks/${disabled.id}`);
  expect(calls[3]!.url).toEndWith("/game_videos/webhooks/");
  expect(String(calls[3]!.body)).toBe(
    new URLSearchParams({ url: missingUrl, method: "create", secret }).toString(),
  );
  const healthy = await ensureWebhooks({ baseUrl, secret });
  expect(healthy.active).toBe(24);
  expect(calls.at(-1)?.method).toBe("GET");
}, 10000);

test("a partial repair continues other repairs but fails the job for monitoring", async () => {
  configured();
  const current = hooks();
  current[0]!.active = false;
  current[1]!.active = false;
  const calls = scriptFetch([json(current), json({}, 400), json({}), json({}), json(hooks())]);
  const worker = fakeBoss();
  await registerWebhookWorker(worker.boss);
  await expect(worker.run()).rejects.toThrow("Failed to restore 1 IGDB webhook subscriptions");
  expect(calls.map((c) => c.method)).toEqual(["GET", "DELETE", "DELETE", "POST"]);
  await worker.run();
  expect(calls.at(-1)?.method).toBe("GET");
}, 10000);

test("failed inspection is reported as a failed job without changing subscriptions", async () => {
  configured();
  const calls = scriptFetch([json({}, 403)]);
  const worker = fakeBoss();
  await registerWebhookWorker(worker.boss);
  await expect(worker.run()).rejects.toThrow("failed with 403");
  expect(calls.map((c) => c.method)).toEqual(["GET"]);
});

test("without webhook configuration removes the old schedule and never calls IGDB", async () => {
  delete process.env.IGDB_WEBHOOK_SECRET;
  const calls = scriptFetch([]);
  const worker = fakeBoss();
  await registerWebhookWorker(worker.boss);
  expect(worker.calls).toEqual([{ method: "unschedule", args: [QUEUES.ENSURE_WEBHOOKS] }]);
  expect(calls).toEqual([]);
});
