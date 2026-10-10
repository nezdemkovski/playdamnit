import { Elysia } from "elysia";
import { betterAuth } from "@/lib/betterAuth";
import { UserService } from "@/modules/user/service";

export const getMe = new Elysia().use(betterAuth).get("/me", {
  auth: true,
}, ({ user: authUser }) => UserService.findById(authUser.id));
