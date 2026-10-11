import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { USER_SORTS, UserService } from "@/modules/user/service";

export const getUsers = new Elysia().use(betterAuth).get(
  "/users",
  {
    viewer: true,
    query: t.Object({
      q: t.Optional(t.String({ maxLength: 50 })),
      sort: t.Optional(t.Union(USER_SORTS.map((s) => t.Literal(s)))),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, default: 30 })),
      offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
    }),
  },
  ({ query, viewer }) =>
    UserService.search({
      q: query.q,
      sort: query.sort,
      limit: query.limit ?? 30,
      offset: query.offset ?? 0,
      viewerId: viewer?.id ?? null,
    }),
);
