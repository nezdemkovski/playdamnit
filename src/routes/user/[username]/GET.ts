import { Elysia, t } from "elysia";
import { UserService } from "@/modules/user/service";

export const getUser = new Elysia().get(
  "/user/:username",
  ({ params }) => UserService.findByUsername(params.username),
  {
    params: t.Object({
      username: t.String(),
    }),
  }
);
