import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { HttpMethod } from "@/utils/enums";
import baseline from "./fixtures/released-contract.json";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}
const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

test("contracts supported by released native clients remain unchanged", () => {
  const spec = Bun.YAML.parse(
    readFileSync(new URL("../../../packages/api-client/spec.yaml", import.meta.url), "utf8"),
  ) as {
    paths: Record<string, unknown>;
    components: { schemas: Record<string, unknown> };
  };
  for (const [path, expected] of Object.entries(baseline.paths)) {
    const current = spec.paths[path] as Record<string, unknown> | undefined;
    const keys = baseline.pathKeys[path as keyof typeof baseline.pathKeys];
    // Additional HTTP operations are compatible; every original operation and shared
    // path option must remain byte-equivalent. New shared options still fail the check.
    const operations = new Set(Object.values(HttpMethod).map((method) => method.toLowerCase()));
    const supported =
      current &&
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !operations.has(key) || keys.includes(key)),
      );
    expect(hash(supported), path).toBe(expected);
  }
  for (const [name, expected] of Object.entries(baseline.schemas))
    expect(hash(spec.components.schemas[name]), name).toBe(expected);
});
