import { test, expect } from "bun:test";
import { revokeAppleToken } from "@/modules/user/appleDeletion";
test("legacy ID-token-only Apple accounts can still be deleted", async () => {
  let called = false;
  expect(
    await revokeAppleToken({ clientId: "app", clientSecret: "", refreshToken: null }, async () => {
      called = true;
      return new Response();
    }),
  ).toBe(false);
  expect(called).toBe(false);
});
test("Apple revocation sends the refresh token to Apple's fixed endpoint", async () => {
  let captured: RequestInit | undefined;
  const send = async (url: unknown, init: RequestInit) => {
    expect(url).toBe("https://appleid.apple.com/auth/revoke");
    captured = init;
    return new Response(null, { status: 200 });
  };
  expect(
    await revokeAppleToken(
      { clientId: "app", clientSecret: "test-secret", refreshToken: "test-refresh" },
      send,
    ),
  ).toBe(true);
  const body = captured?.body as URLSearchParams;
  expect(body.get("token_type_hint")).toBe("refresh_token");
  expect(body.get("token")).toBe("test-refresh");
});
test("failed Apple revocation does not expose credentials", async () => {
  const send = async () => new Response("test-secret", { status: 500 });
  await expect(
    revokeAppleToken(
      { clientId: "app", clientSecret: "test-secret", accessToken: "test-access" },
      send,
    ),
  ).rejects.toThrow("Apple authorization revocation failed");
});
