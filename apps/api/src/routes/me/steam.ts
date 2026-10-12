import { Elysia, t } from "elysia";
import { UserGameStatus } from "@playdamnit/db/enums";

import { getConfig } from "@/config";
import { betterAuth } from "@/lib/betterAuth";
import { decodeState, encodeState, steamLoginUrl, verifySteamLogin } from "@/modules/steam/openid";
import { SteamService } from "@/modules/steam/service";
import { BadRequestError } from "@/utils/errors";
import { Origin, SteamConnectResult } from "@/utils/enums";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";

// Each call asks Steam for the whole library; keep it to a handful per user
const steamLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

const { betterAuthUrl, trustedOrigins, isDev } = getConfig();
const CALLBACK_PATH = "/api/me/steam/callback";
const callbackUrl = () => new URL(CALLBACK_PATH, betterAuthUrl).toString();

/** Only pages of this site may be returned to; anything else would be an open redirect */
const safeReturnTo = (returnTo: string) => {
  let url: URL;
  try {
    url = new URL(returnTo);
  } catch {
    throw new BadRequestError("Bad return address");
  }
  const allowed =
    trustedOrigins.includes(url.origin) ||
    (betterAuthUrl && new URL(betterAuthUrl).origin === url.origin) ||
    (isDev && url.origin.startsWith(Origin.LocalhostHttp));
  if (!allowed) throw new BadRequestError("Bad return address");
  return url;
};

const backTo = (returnTo: string, result: SteamConnectResult) => {
  const url = new URL(returnTo);
  url.searchParams.set("steam", result);
  return url.toString();
};

export const steamImportRoutes = new Elysia()
  .use(betterAuth)
  // Sync the linked account now
  .post(
    "/me/import/steam",
    {
      auth: true,
      body: t.Object({ playedStatus: t.Optional(t.Enum(UserGameStatus)) }),
    },
    ({ user, body, request, server }) => {
      steamLimiter.check(clientKey({ request, server }, user.id));
      return SteamService.import(user.id, body.playedStatus ?? UserGameStatus.OnHold);
    },
  )
  // Sign in through Steam: off to Steam, which sends the browser back to the callback
  .get(
    "/me/steam/connect",
    { auth: true, query: t.Object({ returnTo: t.String({ maxLength: 2000 }) }) },
    ({ user, query, redirect }) => {
      const returnTo = safeReturnTo(query.returnTo).toString();
      const callback = new URL(callbackUrl());
      callback.searchParams.set("state", encodeState(user.id, returnTo));
      return redirect(steamLoginUrl(callback.toString()));
    },
  )
  // Steam's answer: proven SteamID64 → link and import, then back to the page that started it
  .get(
    CALLBACK_PATH.replace("/api", ""),
    { viewer: true, query: t.Record(t.String(), t.String()) },
    async ({ viewer, query, redirect }) => {
      const state = decodeState(query.state ?? "");
      if (!state) throw new BadRequestError("This Steam sign-in expired. Try again.");
      // The state ties the round trip to the member who started it
      if (!viewer || viewer.id !== state.userId) {
        return redirect(backTo(state.returnTo, SteamConnectResult.Failed));
      }
      const steamId = await verifySteamLogin(query, callbackUrl()).catch(() => null);
      if (!steamId) return redirect(backTo(state.returnTo, SteamConnectResult.Failed));
      steamLimiter.check(viewer.id);
      const result = await SteamService.connect(viewer.id, steamId).catch(
        () => SteamConnectResult.Failed,
      );
      return redirect(backTo(state.returnTo, result));
    },
  )
  .get("/me/steam/friends", { auth: true }, ({ user }) => SteamService.friends(user.id))
  .delete("/me/steam", { auth: true }, ({ user }) => SteamService.unlink(user.id));
