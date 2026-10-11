import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { GameService } from "@/modules/game/service";

const params = t.Object({ id: t.Numeric() });

export const gameLikeRoutes = new Elysia()
  .use(betterAuth)
  .post("/games/:id/like", { auth: true, params }, ({ params, user }) =>
    GameService.like(user.id, params.id),
  )
  .delete("/games/:id/like", { auth: true, params }, ({ params, user }) =>
    GameService.unlike(user.id, params.id),
  );
