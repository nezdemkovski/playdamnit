import { Elysia } from "elysia";
import { auth } from "./auth";

// Auth endpoints are served by the /api/auth/* route in src/index.ts. Mounting the
// handler here as well made it swallow every unknown /api/* path with an empty 404.
export const betterAuth = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async derive({ status, request: { headers } }) {
      const session = await auth.api.getSession({
        headers,
      });

      // The body the API contract describes, so clients can read it like any other error
      if (!session)
        return status(401, { error: "Unauthorized", message: "Authentication required" });

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
