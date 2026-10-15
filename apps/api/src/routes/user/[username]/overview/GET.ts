import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";

export const getUserOverview = new Elysia().use(betterAuth).get(
  "/user/:username/overview",
  {
    viewer: true,
    params: t.Object({ username: t.String() }),
  },
  ({ params, viewer }) => UserGameService.getOverview(params.username, viewer?.id ?? null),
);
