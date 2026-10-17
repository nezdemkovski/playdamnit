import { Elysia } from "elysia";
import { auth } from "./auth";
import { isDemoUser } from "@/utils/social";
import { ApiErrorCode, HttpMethod } from "@/utils/enums";

// The body the API contract describes for a missing session, so clients can read it like any other error
export const UNAUTHORIZED = { error: "Unauthorized", message: "Authentication required" } as const;
// The demo account's answer to anything that would write; `code` lets the apps say so in their words
export const DEMO_READ_ONLY = {
  error: "Forbidden",
  message: "This is the demo account: nothing is saved. Create an account to keep your own list.",
  code: ApiErrorCode.DemoReadOnly,
} as const;

const READ_METHODS = new Set<string>([HttpMethod.Get, HttpMethod.Head, HttpMethod.Options]);

// Auth endpoints are served by the /api/auth/* route in src/index.ts. Mounting the
// handler here as well made it swallow every unknown /api/* path with an empty 404.
export const betterAuth = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async derive({ status, request: { headers, method } }) {
      const session = await auth.api.getSession({
        headers,
      });

      if (!session) return status(401, UNAUTHORIZED);
      // The shared demo account may look at everything a member can, and change nothing
      if (isDemoUser(session.user) && !READ_METHODS.has(method)) return status(403, DEMO_READ_ONLY);

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
