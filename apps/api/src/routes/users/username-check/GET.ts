import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { checkUsername } from "@/modules/user/username";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";

// Asked as a name is typed (after a pause), so generous, but it still tells taken names apart
const usernameLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const getUsernameCheck = new Elysia().use(betterAuth).get(
  "/users/username-check",
  {
    viewer: true,
    query: t.Object({ username: t.String({ maxLength: 100 }) }),
  },
  ({ query, viewer, request, server }) => {
    usernameLimiter.check(clientKey({ request, server }, viewer?.id));
    return checkUsername(query.username, viewer?.username ?? null);
  },
);
