import { afterEach, describe, expect, test } from "bun:test";

// Twitch token request must never leave the test
process.env.TWITCH_CLIENT_ID = "test";
process.env.TWITCH_CLIENT_SECRET = "test";

const { igdbQuery, igdbFetch } = await import("@/utils/igdb/utils");

const originalFetch = globalThis.fetch;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

/** Script the responses fetch returns, in order; the Twitch token request always succeeds. */
const scriptFetch = (responses: (() => Response | Promise<Response>)[]) => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("id.twitch.tv")) return json({ access_token: "t", expires_in: 3600 });
    calls.push(url);
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return next();
  }) as typeof fetch;
  return calls;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("IGDB request retries", () => {
  test("waits out a 429 and succeeds", async () => {
    const calls = scriptFetch([
      () => new Response("slow down", { status: 429, headers: { "retry-after": "0" } }),
      () => json([{ id: 1 }]),
    ]);
    expect(await igdbQuery<{ id: number }[]>("games", "fields id;")).toEqual([{ id: 1 }]);
    expect(calls.length).toBe(2);
  });

  test("retries transient 5xx and network errors, then gives up", async () => {
    const calls = scriptFetch([
      () => new Response("bad gateway", { status: 502 }),
      () => Promise.reject(new Error("socket hang up")),
      () => new Response("unavailable", { status: 503 }),
      () => new Response("still down", { status: 503 }),
    ]);
    await expect(igdbQuery("games", "fields id;")).rejects.toThrow("failed with 503");
    expect(calls.length).toBe(4);
  }, 20_000);

  test("does not retry client errors", async () => {
    const calls = scriptFetch([() => new Response("nope", { status: 400 })]);
    await expect(igdbFetch("GET", "webhooks")).rejects.toThrow("failed with 400");
    expect(calls.length).toBe(1);
  });
});
