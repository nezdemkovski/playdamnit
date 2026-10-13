import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { MAX_TASTE_MATCHES, TasteService } from "@/modules/taste/service";

export const tasteRoutes = new Elysia().use(betterAuth).get(
  "/me/taste-matches",
  {
    auth: true,
    query: t.Object({
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_TASTE_MATCHES, default: 10 })),
    }),
  },
  ({ user, query }) => TasteService.matches(user.id, query.limit ?? 10),
);
