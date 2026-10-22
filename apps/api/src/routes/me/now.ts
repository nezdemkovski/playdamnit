import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";

/** The Now tab, ready to draw */
export const getMeNow = new Elysia().use(betterAuth).get(
  "/me/now",
  {
    auth: true,
    query: t.Object({
      // IANA zone "today" is counted in for the week's releases, the member's own (default UTC)
      tz: t.Optional(t.String({ maxLength: 64 })),
    }),
  },
  ({ user, query }) => UserGameService.getNow(user.id, query),
);
