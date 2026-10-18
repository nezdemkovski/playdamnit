import { Elysia } from "elysia";
import { auth } from "./auth";

// The body the API contract describes for a missing session, so clients can read it like any other error
export const UNAUTHORIZED = { error: "Unauthorized", message: "Authentication required" } as const;
// Auth endpoints are served by the /api/auth/* route in src/index.ts. Mounting the
// handler here as well made it swallow every unknown /api/* path with an empty 404.
export const betterAuth = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async derive({ status, request: { headers } }) {
      // Observe revoked sessions immediately on protected endpoints, including moderator bans.
      const session = await auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      });

      if (!session) return status(401, UNAUTHORIZED);

      return {
        user: session.user,
        session: session.session,
      };
    },
  },
  // Public routes that behave differently for a signed-in viewer (likes, follow state, privacy)
  viewer: {
    async derive({ request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      return { viewer: session?.user ?? null };
    },
  },
});

/**
 * The signed-in member's id, looked up only when a public route needs it (a `mine=1` filter),
 * so the catalog's anonymous traffic never pays for the session lookup
 */
export const sessionUserId = async (headers: Headers) =>
  (await auth.api.getSession({ headers }))?.user.id ?? null;
