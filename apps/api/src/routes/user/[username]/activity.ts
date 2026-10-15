import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { ACTIVITY_DAYS, UserService } from "@/modules/user/service";

/** The profile's activity map, ready to draw: the active days with their games and levels */
export const getUserActivity = new Elysia().use(betterAuth).get(
  "/user/:username/activity",
  {
    viewer: true,
    params: t.Object({ username: t.String() }),
    query: t.Object({
      days: t.Optional(t.Numeric({ minimum: 1, maximum: 366, default: ACTIVITY_DAYS })),
      // IANA zone the days are counted in, the viewer's own (default UTC)
      tz: t.Optional(t.String({ maxLength: 64 })),
    }),
  },
  ({ params, query, viewer }) => UserService.activity(params.username, viewer?.id ?? null, query),
);
