import { betterAuth } from "better-auth";
import { deleteAccount } from "@playdamnit/emails";
import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import { Client } from "pg";

async function createTestAuth(mails: string[]) {
  const { auth: configured } = await import("@/lib/auth");
  return betterAuth({
    ...configured.options,
    user: {
      ...configured.options.user,
      deleteUser: {
        ...configured.options.user?.deleteUser,
        enabled: true,
        sendDeleteAccountVerification: async ({ url: confirmationURL }) => {
          mails.push((await deleteAccount({ url: confirmationURL, appleConnected: true })).text);
        },
      },
    },
  });
}

const url = process.env.TEST_POSTGRES_URL;
describe.skipIf(!url)("passwordless account deletion", () => {
  let pg: Client;
  let auth: Awaited<ReturnType<typeof createTestAuth>>;
  let headers: Headers;
  let userId: string;
  let token: string;
  const mails: string[] = [];
  beforeAll(async () => {
    const { runMigrations } = await import("@playdamnit/db/migrate");
    await runMigrations(url!);
    pg = new Client(url);
    await pg.connect();
    await pg.query('truncate "user" cascade');
    auth = await createTestAuth(mails);
    await auth.api.signUpEmail({
      body: { email: "delete@example.test", password: "test-password-123", name: "Delete me" },
    });
    await pg.query(`update "user" set email_verified=true where email='delete@example.test'`);
    const response = await auth.api.signInEmail({
      body: { email: "delete@example.test", password: "test-password-123" },
      asResponse: true,
    });
    headers = new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((x) => x.split(";")[0])
        .join("; "),
      origin: "http://localhost:3030",
    });
    userId = (await pg.query(`select id from "user" where email='delete@example.test'`)).rows[0].id;
    await pg.query(`delete from account where user_id=$1`, [userId]);
    await pg.query(
      `insert into account (id,provider_id,account_id,user_id,updated_at) values ('apple-delete','apple','apple-subject',$1,now())`,
      [userId],
    );
    await pg.query(`update session set created_at=now()-interval '3 days' where user_id=$1`, [
      userId,
    ]);
    mails.length = 0;
  });
  afterAll(async () => {
    await pg?.end();
  });
  test("a stale-session Apple account starts deletion without inventing a password", async () => {
    const result = await auth.api.deleteUser({ headers, body: {} });
    expect(result.message).toBe("Verification email sent");
    expect((await pg.query('select id from "user" where id=$1', [userId])).rowCount).toBe(1);
    expect(mails.length).toBe(1);
    const text = mails[0]!;
    expect(text).toContain("account.apple.com");
    token = text.match(/token=([A-Za-z0-9]+)/)![1]!;
  });
  test("confirmation deletes the account and Apple linkage, then cannot be replayed", async () => {
    await auth.api.deleteUser({ headers, body: { token } });
    expect((await pg.query('select id from "user" where id=$1', [userId])).rowCount).toBe(0);
    expect((await pg.query("select id from account where user_id=$1", [userId])).rowCount).toBe(0);
    expect((await pg.query("select id from session where user_id=$1", [userId])).rowCount).toBe(0);
    await expect(auth.api.deleteUser({ headers, body: { token } })).rejects.toThrow();
  });
});
