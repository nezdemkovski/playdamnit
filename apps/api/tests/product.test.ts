import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { getChangelog } from "../src/modules/product/changelog";
import { createFeedbackService, feedbackId } from "../src/modules/product/feedback";
import { FeedbackKind, ProductPlatform } from "../src/modules/product/model";
import { productRoutes } from "../src/routes/product";

const input = {
  requestId: "ff8f2400-3ed0-463b-a501-c4870ef3691a",
  kind: FeedbackKind.Bug,
  title: "  Library problem  ",
  message: "  My games are missing  ",
  platform: ProductPlatform.IOS,
  appVersion: "1.0.1 (99)",
  locale: "ru",
};
const actor = { id: "member", username: "tester" };
const id = feedbackId(actor.id, input.requestId);
const options = { apiKey: "unit-test-only", teamId: "team", projectId: "project" };
const json = (body: unknown) => Response.json(body);

function fake(responses: (() => Response | Promise<Response>)[]) {
  const calls: { query: string; variables: Record<string, any> }[] = [];
  const fetcher = (async (_url: unknown, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string));
    const response = responses.shift();
    if (!response) throw new Error("Unexpected call");
    return response();
  }) as typeof fetch;
  return { calls, service: createFeedbackService({ ...options, fetcher }) };
}

describe("product endpoints", () => {
  test("the shared history localizes, filters and falls back to English", () => {
    const en = getChangelog();
    expect(en.releases.length).toBeGreaterThan(0);
    expect(getChangelog("unknown")).toEqual(en);
    for (const locale of ["ru-RU", "es", "ja", "zh-CN"]) {
      const result = getChangelog(locale, ProductPlatform.IOS);
      expect(result.releases[0].changes[0].title).not.toBe(en.releases[0].changes[0].title);
      expect(
        result.releases.every(
          (r) => r.platform === ProductPlatform.All || r.platform === ProductPlatform.IOS,
        ),
      ).toBe(true);
    }
  });
  test("history is public and invalid query is rejected", async () => {
    const app = new Elysia().use(productRoutes);
    const response = await app.handle(new Request("http://localhost/changelog?locale=ru"));
    expect(response.status).toBe(200);
    const history = (await response.json()) as ReturnType<typeof getChangelog>;
    expect(history.releases[0].changes[0].title).toContain("Предлагай");
    expect(
      (await app.handle(new Request("http://localhost/changelog?platform=invalid"))).status,
    ).toBeGreaterThanOrEqual(400);
  });
  test("feedback requires authentication", async () => {
    const app = new Elysia().use(productRoutes);
    const response = await app.handle(
      new Request("http://localhost/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    expect(response.status).toBe(401);
  });
  test("creates a task in the configured project and returns only an opaque receipt", async () => {
    const { calls, service } = fake([
      () => json({ data: { issue: null } }),
      () => json({ data: { issueCreate: { success: true, issue: { id } } } }),
    ]);
    expect(await service.submit(actor, input)).toEqual({ id });
    const sent = calls[1].variables.input;
    expect(sent.teamId).toBe("team");
    expect(sent.projectId).toBe("project");
    expect(sent.title).toBe("[Bug] Library problem");
    expect(sent.description).toContain("@tester");
    expect(sent.description).toContain("1.0.1 (99)");
    expect(sent.description).not.toContain("unit-test-only");
  });
  test("retries return the existing issue without creating a duplicate", async () => {
    const { calls, service } = fake([() => json({ data: { issue: { id } } })]);
    expect(await service.submit(actor, input)).toEqual({ id });
    expect(calls).toHaveLength(1);
    expect(feedbackId("another-member", input.requestId)).not.toBe(id);
  });
  test("a timeout after acceptance finds the task instead of duplicating it", async () => {
    const { service } = fake([
      () => json({ data: { issue: null } }),
      () => {
        throw new Error("timeout");
      },
      () => json({ data: { issue: { id } } }),
    ]);
    expect(await service.submit(actor, input)).toEqual({ id });
  });
  test("GraphQL errors at HTTP 200 are not mistaken for success", async () => {
    const { service } = fake([
      () => json({ data: { issue: null } }),
      () => json({ errors: [{ message: "denied" }] }),
      () => json({ data: { issue: null } }),
    ]);
    await expect(service.submit(actor, input)).rejects.toThrow("could not be sent");
  });
  test("missing config, whitespace-only input and provider outage reject honestly", async () => {
    await expect(createFeedbackService({}).submit(actor, input)).rejects.toThrow(
      "temporarily unavailable",
    );
    await expect(
      createFeedbackService(options).submit(actor, { ...input, title: "   " }),
    ).rejects.toThrow("required");
    const { service } = fake([() => new Response(null, { status: 503 })]);
    await expect(service.submit(actor, input)).rejects.toThrow("could not be sent");
  });
});
