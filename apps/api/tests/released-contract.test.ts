import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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

test("new product endpoints leave every preexisting operation and schema unchanged", () => {
  const spec = Bun.YAML.parse(
    readFileSync(new URL("../../../packages/api-client/spec.yaml", import.meta.url), "utf8"),
  ) as {
    paths: Record<string, unknown>;
    components: { schemas: Record<string, unknown> };
  };
  for (const [path, expected] of Object.entries(baseline.paths))
    expect(hash(spec.paths[path]), path).toBe(expected);
  for (const [name, expected] of Object.entries(baseline.schemas))
    expect(hash(spec.components.schemas[name]), name).toBe(expected);
});
