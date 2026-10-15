import { Elysia, t } from "elysia";

import { showcase } from "@/modules/game/showcase";

/**
 * Well-known games with real scores, dealt over the whole grade scale: the app's welcome show.
 * Without a seed it starts a new order; with the seed and `nextPage` it goes on where it left off.
 */
export const getGameShowcase = new Elysia().get(
  "/games/showcase",
  {
    query: t.Object({
      seed: t.Optional(t.String({ pattern: "^[a-f0-9]{1,32}$" })),
      page: t.Optional(t.Numeric({ minimum: 0, maximum: 1000 })),
    }),
  },
  ({ query }) => showcase(query.seed, query.page ?? 0),
);
