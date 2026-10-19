import { describe, expect, test } from "bun:test";
import { verdictOf } from "@/modules/game/verdict";
import { todayIn } from "@/modules/userGame/completionDate";
import { Grade, VerdictSource } from "@/utils/enums";

describe("server-owned verdict", () => {
  test("overall leads below ten votes and members take over at ten", () => {
    expect(verdictOf(95, 500, 5, 9)).toEqual({
      source: VerdictSource.Overall,
      grade: Grade.S,
      count: 500,
    });
    expect(verdictOf(95, 500, 5, 10)).toEqual({
      source: VerdictSource.Members,
      grade: Grade.D,
      count: 10,
    });
  });
  test("missing scores remain ungraded, including inconsistent member counts", () => {
    expect(verdictOf(null, null, null, 10)).toEqual({
      source: VerdictSource.Overall,
      grade: null,
      count: 0,
    });
    expect(verdictOf(85, 7, 0, 10).source).toBe(VerdictSource.Overall);
  });
});

describe("completion day", () => {
  const now = new Date("2026-01-01T00:30:00Z");
  test("uses the member's calendar day on both sides of UTC midnight", () => {
    expect(todayIn("America/Los_Angeles", now)).toBe("2025-12-31");
    expect(todayIn("Pacific/Kiritimati", now)).toBe("2026-01-01");
    expect(todayIn("Europe/Prague", now)).toBe("2026-01-01");
  });
  test("rejects unknown time zones", () => {
    expect(() => todayIn("Invalid/Zone", now)).toThrow("Invalid time zone");
  });
});
