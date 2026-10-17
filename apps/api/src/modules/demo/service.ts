import { eq } from "drizzle-orm";

import { account, db, session, user } from "@/db/postgres";
import { auth } from "@/lib/auth";
import { getConfig } from "@/config";
import { NotFoundError, ServiceUnavailableError } from "@/utils/errors";
import { AuthProviderId, UserRole } from "@/utils/enums";
import { isDemoUser } from "@/utils/social";

const { demoUsername, demoPassword } = getConfig();

/** A demo session lasts a day: the account is shared, so a device does not keep it for weeks */
const DEMO_SESSION_MS = 24 * 60 * 60 * 1000;

/**
 * The shared read-only demo account: the apps sign into it from the welcome screen so a
 * visitor sees every feature with a real library. The API refuses everything it would write
 * (`auth` macro, Better Auth hooks) and keeps it out of member lists and searches
 * (`utils/social.ts`). `DEMO_USERNAME` and `DEMO_PASSWORD` name it; without both it is off.
 */
export abstract class DemoService {
  static get enabled() {
    return !!(demoUsername && demoPassword);
  }

  /**
   * Signs into the demo account on the caller's behalf and returns Better Auth's cookies to
   * forward. The password never leaves the server.
   */
  static async signIn(): Promise<{ cookies: string[] }> {
    if (!demoUsername || !demoPassword) throw new NotFoundError("The demo is not available");
    const signedIn = await auth.api
      .signInUsername({
        body: { username: demoUsername, password: demoPassword },
        returnHeaders: true,
      })
      // No such account yet, or another password: the environment is set but the account is not
      .catch(() => null);
    if (!signedIn?.response || !isDemoUser(signedIn.response.user)) {
      // Not set up (see scripts/demo-account.ts), or the name is a member's: never hand out a session
      throw new ServiceUnavailableError("The demo account is not set up");
    }
    const { headers, response } = signedIn;
    await db
      .update(session)
      .set({ expiresAt: new Date(Date.now() + DEMO_SESSION_MS) })
      .where(eq(session.token, response.token));
    return { cookies: headers.getSetCookie() };
  }

  /**
   * Makes the account named by the environment, or resets its password and flags: written
   * straight to the tables, as Better Auth's sign-up would send a confirmation email and
   * refuse without one. Its list is private, so nothing of it shows to members either way.
   */
  static async ensureAccount(opts: { email: string; name: string }) {
    if (!demoUsername || !demoPassword)
      throw new Error("DEMO_USERNAME and DEMO_PASSWORD are not set");
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(demoPassword);
    const existing = await DemoService.find();
    // Never turn a member into the demo: the name must be free, or the demo's already
    if (existing && !isDemoUser(existing)) {
      throw new Error(`@${demoUsername} belongs to a member; pick another DEMO_USERNAME`);
    }
    const id = existing?.id ?? crypto.randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .update(user)
          .set({ role: UserRole.Demo, emailVerified: true, listPublic: false, updatedAt: now })
          .where(eq(user.id, id));
        await tx
          .update(account)
          .set({ password: hash, updatedAt: now })
          .where(eq(account.userId, id));
      } else {
        await tx.insert(user).values({
          id,
          name: opts.name,
          email: opts.email,
          emailVerified: true,
          username: demoUsername.toLowerCase(),
          displayUsername: demoUsername,
          role: UserRole.Demo,
          listPublic: false,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(account).values({
          id: crypto.randomUUID(),
          accountId: id,
          providerId: AuthProviderId.Credential,
          userId: id,
          password: hash,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
    return { id, created: !existing };
  }

  /**
   * Locked, the account is the read-only demo; unlocked it is a regular (private) member, for
   * filling its library by hand with the apps
   */
  static async setLocked(locked: boolean) {
    const existing = await DemoService.find();
    if (!existing) throw new Error(`no account @${demoUsername}; create it first`);
    await db
      .update(user)
      .set({ role: locked ? UserRole.Demo : null, listPublic: false, updatedAt: new Date() })
      .where(eq(user.id, existing.id));
    return existing;
  }

  private static find() {
    if (!demoUsername) return Promise.resolve(undefined);
    return db.query.user.findFirst({
      where: { username: demoUsername.toLowerCase() },
      columns: { id: true, role: true },
    });
  }
}
