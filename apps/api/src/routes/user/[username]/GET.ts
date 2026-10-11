import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserService } from "@/modules/user/service";

export const getUser = new Elysia().use(betterAuth).get(
  "/user/:username",
  {
    viewer: true,
    params: t.Object({
      username: t.String(),
    }),
  },
  ({ params, viewer }) => UserService.findByUsername(params.username, viewer?.id ?? null),
);
