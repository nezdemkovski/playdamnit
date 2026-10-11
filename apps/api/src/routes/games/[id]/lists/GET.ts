import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { ListService } from "@/modules/list/service";

/** The signed-in user's lists, flagged with whether they contain the game */
export const getGameListMembership = new Elysia()
  .use(betterAuth)
  .get(
    "/games/:id/lists",
    { auth: true, params: t.Object({ id: t.Numeric() }) },
    ({ params, user }) => ListService.membership(user.id, params.id),
  );
