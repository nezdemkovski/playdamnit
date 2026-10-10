import { describe, expect, test } from "bun:test";

import { parseCSV, toCSV } from "@/modules/userGame/csv";
import { UserGameService } from "@/modules/userGame/service";
import { escapeLike } from "@/utils/searchGames";
import { createRateLimiter } from "@/utils/rateLimit";
import { TooManyRequestsError } from "@/utils/errors";

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
    UserGameService.normalizeImportRow({ gameId: 10, status: "playing", ...overrides });

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
    expect(row({ status: "finished", endedAt: "2999-01-01" })).toMatchObject({ ok: false });
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
    const app = new Elysia().patch("/", {
      body: t.Object({ status: t.Optional(statusSchema), rating: t.Optional(t.Number()) }),
    }, ({ body }) => body);

    const res = await app.handle(
      new Request("http://localhost/", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: 5 }),
      })
    );

    expect(await res.json()).toEqual({ rating: 5 });
  });
});
