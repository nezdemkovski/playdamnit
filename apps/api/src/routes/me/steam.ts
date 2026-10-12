import { Elysia, t } from "elysia";
import { UserGameStatus } from "@playdamnit/db/enums";

import { betterAuth } from "@/lib/betterAuth";
import { SteamService } from "@/modules/steam/service";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";

// Each call asks Steam for the whole library; keep it to a handful per user
const steamLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

const profile = t.String({ minLength: 2, maxLength: 200 });

export const steamImportRoutes = new Elysia()
  .use(betterAuth)
  .post(
    "/me/import/steam",
    {
      auth: true,
      body: t.Object({
        profile: t.Optional(profile),
        playedStatus: t.Optional(t.Enum(UserGameStatus)),
      }),
    },
    ({ user, body, request, server }) => {
      steamLimiter.check(clientKey({ request, server }, user.id));
      return SteamService.import(user.id, body.playedStatus ?? UserGameStatus.OnHold, body.profile);
    },
  )
  .get("/me/steam/friends", { auth: true }, ({ user }) => SteamService.friends(user.id))
  .delete("/me/steam", { auth: true }, ({ user }) => SteamService.unlink(user.id));
