import { describe, expect, test } from "bun:test";

import { parseCSV, toCSV } from "@/modules/userGame/csv";
import { UserGameService } from "@/modules/userGame/service";
import { escapeLike } from "@/utils/searchGames";
import { createRateLimiter } from "@/utils/rateLimit";
import { TooManyRequestsError } from "@/utils/errors";
import { UserGameStatus } from "@playdamnit/db/enums";
import { HttpMethod, SteamOpenId } from "@/utils/enums";
import { decodeState, encodeState, steamLoginUrl, verifySteamLogin } from "@/modules/steam/openid";

describe("csv", () => {
  test("round-trips quotes, commas, newlines and CRLF", () => {
    const rows = [
      { gameId: 1, review: 'line one\nline "two", with comma' },
      { gameId: 2, review: "plain" },
    ];
    const csv = toCSV(["gameId", "review"], rows).replace(/\n(?=\d)/g, "\r\n");
    expect(parseCSV(csv)).toEqual([
      { gameId: "1", review: 'line one\nline "two", with comma' },
      { gameId: "2", review: "plain" },
    ]);
  });

  test("neutralises spreadsheet formulas on export", () => {
    expect(toCSV(["review"], [{ review: "=HYPERLINK(1)" }])).toBe("review\n'=HYPERLINK(1)\n");
  });

  test("ignores a BOM and blank lines", () => {
    expect(parseCSV("﻿gameId,status\n\n1,playing\n\n")).toEqual([
      { gameId: "1", status: "playing" },
    ]);
  });
});

describe("normalizeImportRow", () => {
  const row = (overrides: Record<string, unknown>) =>
    UserGameService.normalizeImportRow({
      gameId: 10,
      status: UserGameStatus.Playing,
      ...overrides,
    });

  test("accepts a minimal row", () => {
    expect(row({})).toMatchObject({ ok: true, gameId: 10 });
  });

  test("treats platformId 0 from old exports as no platform", () => {
    expect(row({ platformId: 0 })).toMatchObject({ ok: true, value: { platformId: null } });
  });

  test("undoes the export's formula escaping", () => {
    expect(row({ review: "'=SUM(1)" })).toMatchObject({ ok: true, value: { review: "=SUM(1)" } });
  });

  test("rejects bad input", () => {
    expect(row({ gameId: "abc" })).toMatchObject({ ok: false });
    expect(row({ status: "nope" })).toMatchObject({ ok: false });
    expect(row({ rating: 11 })).toMatchObject({ ok: false });
    expect(row({ endedAt: "2020-01-01" })).toMatchObject({ ok: false });
    expect(row({ status: UserGameStatus.Finished, endedAt: "2999-01-01" })).toMatchObject({
      ok: false,
    });
  });
});

describe("escapeLike", () => {
  test("escapes LIKE wildcards", () => {
    expect(escapeLike("100%_\\")).toBe("100\\%\\_\\\\");
  });
});

describe("rate limiter", () => {
  test("blocks after the limit within a window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("a");
    limiter.check("a");
    expect(() => limiter.check("a")).toThrow(TooManyRequestsError);
    expect(() => limiter.check("b")).not.toThrow();
  });
});

describe("request schemas", () => {
  test("an omitted optional status stays omitted", async () => {
    const { Elysia, t } = await import("elysia");
    const { statusSchema } = await import("@/modules/userGame/model");
    const app = new Elysia().patch(
      "/",
      {
        body: t.Object({ status: t.Optional(statusSchema), rating: t.Optional(t.Number()) }),
      },
      ({ body }) => body,
    );

    const res = await app.handle(
      new Request("http://localhost/", {
        method: HttpMethod.Patch,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: 5 }),
      }),
    );

    expect(await res.json()).toEqual({ rating: 5 });
  });
});

describe("sign in through Steam", () => {
  const CALLBACK = "http://localhost:3030/api/me/steam/callback";
  const STEAM_ID = "76561199420922704";
  const answer = (overrides: Record<string, string> = {}) => ({
    "openid.ns": SteamOpenId.Namespace,
    "openid.mode": "id_res",
    "openid.op_endpoint": SteamOpenId.Endpoint,
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.return_to": `${CALLBACK}?state=abc`,
    "openid.response_nonce": "2026-10-12T02:00:00Zxyz",
    "openid.assoc_handle": "1234567890",
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "c2lnbmF0dXJl",
    ...overrides,
  });

  test("the state round-trips and refuses tampering", () => {
    const state = encodeState("alice", "http://localhost:3000/alice");
    expect(decodeState(state)).toMatchObject({
      userId: "alice",
      returnTo: "http://localhost:3000/alice",
    });
    const [payload, sig] = state.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        userId: "mallory",
        returnTo: "http://localhost:3000",
        expires: Date.now() + 1e6,
      }),
    ).toString("base64url");
    expect(decodeState(`${forged}.${sig}`)).toBeNull();
    expect(decodeState(`${payload}.x${sig}`)).toBeNull();
    expect(decodeState("garbage")).toBeNull();
  });

  test("the login URL asks Steam to pick the account and come back to the callback", () => {
    const url = new URL(steamLoginUrl(`${CALLBACK}?state=abc`));
    expect(url.origin + url.pathname).toBe(SteamOpenId.Endpoint);
    expect(url.searchParams.get("openid.return_to")).toBe(`${CALLBACK}?state=abc`);
    expect(url.searchParams.get("openid.realm")).toBe("http://localhost:3030");
    expect(url.searchParams.get("openid.claimed_id")).toBe(SteamOpenId.IdentifierSelect);
  });

  test("an answer counts only when Steam confirms it and it is for this callback", async () => {
    const realFetch = globalThis.fetch;
    let checked: URLSearchParams | null = null;
    globalThis.fetch = (async (_url: string, init: { body: URLSearchParams }) => {
      checked = init.body;
      return new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n");
    }) as unknown as typeof fetch;
    try {
      expect(await verifySteamLogin(answer(), CALLBACK)).toBe(STEAM_ID);
      expect(checked!.get("openid.mode")).toBe("check_authentication");
      expect(checked!.get("openid.sig")).toBe("c2lnbmF0dXJl");
      // Not for us, not from Steam, not a SteamID: refused before asking Steam
      expect(
        await verifySteamLogin(answer({ "openid.return_to": "https://evil.example/cb" }), CALLBACK),
      ).toBeNull();
      expect(
        await verifySteamLogin(
          answer({ "openid.op_endpoint": "https://evil.example/openid" }),
          CALLBACK,
        ),
      ).toBeNull();
      expect(
        await verifySteamLogin(
          answer({ "openid.claimed_id": "https://evil.example/openid/id/76561199420922704" }),
          CALLBACK,
        ),
      ).toBeNull();
      // Steam says no
      globalThis.fetch = (async () => new Response("is_valid:false\n")) as unknown as typeof fetch;
      expect(await verifySteamLogin(answer(), CALLBACK)).toBeNull();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
