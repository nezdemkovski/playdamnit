import { Elysia } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { HomeService } from "@/modules/home/service";

export const getHome = new Elysia()
  .use(betterAuth)
  .get("/home", { viewer: true }, ({ viewer }) => HomeService.load(viewer?.id ?? null));
