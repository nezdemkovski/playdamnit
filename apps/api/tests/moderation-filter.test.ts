import { test, expect } from "bun:test";
import { checkPublicText } from "@/modules/moderation/filter";
test("public content filter rejects clear threats, not ordinary game discussion", () => {
  expect(() => checkPublicText("Kill all jews")).toThrow();
  expect(() => checkPublicText("Ｋｉｌｌ all jews")).toThrow();
  expect(() =>
    checkPublicText("A difficult boss fight. Damn good game.", "Kill the boss"),
  ).not.toThrow();
  expect(() => checkPublicText(null, undefined, "")).not.toThrow();
});
