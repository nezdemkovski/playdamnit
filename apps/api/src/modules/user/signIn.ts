import { count, eq } from "drizzle-orm";

import { db } from "@/db/postgres";
import { auth } from "@/lib/auth";
import { account, passkey } from "@playdamnit/db/schema";
import { AuthProviderId } from "@/utils/enums";

/**
 * How a member can sign in, ready for the settings screen: a password or not, how many passkeys,
 * and whether Apple is linked and may be unlinked. Better Auth refuses to unlink the last linked
 * account (passkeys are not accounts), so Apple can go only while another account remains.
 */
export const signInMethods = async (userId: string) => {
  const [accounts, [keys]] = await Promise.all([
    db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, userId)),
    db.select({ n: count() }).from(passkey).where(eq(passkey.userId, userId)),
  ]);
  const providers = accounts.map((a) => a.providerId);
  const apple = providers.includes(AuthProviderId.Apple);
  return {
    password: providers.includes(AuthProviderId.Credential),
    passkeys: Number(keys?.n ?? 0),
    apple: { linked: apple, canUnlink: apple && providers.length > 1 },
  };
};

/** A first password for an account made with Apple; Better Auth refuses when one is set */
export const setFirstPassword = (headers: Headers, newPassword: string) =>
  auth.api.setPassword({ headers, body: { newPassword } });
