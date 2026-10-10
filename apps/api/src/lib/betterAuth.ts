import { Elysia } from "elysia";
import { auth } from "./auth";

// Auth endpoints are served by the /api/auth/* route in src/index.ts. Mounting the
// handler here as well made it swallow every unknown /api/* path with an empty 404.
export const betterAuth = new Elysia({ name: "better-auth" })
  .macro({
    auth: {
      async derive({ status, request: { headers } }) {
        const session = await auth.api.getSession({
          headers,
        });

        if (!session) return status(401);

        return {
          user: session.user,
          session: session.session,
        };
      },
    },
  });
