import { createHmac, timingSafeEqual } from "node:crypto";

import { getConfig } from "@/config";
import { HttpHeader, HttpMethod, MimeType, OpenIdMode, SteamOpenId } from "@/utils/enums";

/**
 * "Sign in through Steam": Steam speaks OpenID 2.0 only, and all it proves is which SteamID64
 * the person owns. No app registration, no keys; the assertion is checked by asking Steam.
 */

const STATE_TTL_MS = 10 * 60_000;
// Steam answers with https://steamcommunity.com/openid/id/<SteamID64> for whoever signed in;
// every individual account's SteamID64 starts with 7656119 (account type and universe bits)
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;

interface ConnectState {
  userId: string;
  returnTo: string;
  expires: number;
}

const sign = (payload: string) =>
  createHmac("sha256", getConfig().betterAuthSecret ?? "dev-secret")
    .update(payload)
    .digest("base64url");

/** The round trip's state: who started it and where to send them back, signed and short-lived */
export const encodeState = (userId: string, returnTo: string) => {
  const payload = Buffer.from(
    JSON.stringify({ userId, returnTo, expires: Date.now() + STATE_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

export const decodeState = (state: string): ConnectState | null => {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as ConnectState;
    return parsed.expires > Date.now() ? parsed : null;
  } catch {
    return null;
  }
};

/** Where to send the browser: Steam's login page, coming back to `callback` */
export const steamLoginUrl = (callback: string) => {
  const url = new URL(SteamOpenId.Endpoint);
  url.search = new URLSearchParams({
    "openid.ns": SteamOpenId.Namespace,
    "openid.mode": OpenIdMode.CheckIdSetup,
    "openid.return_to": callback,
    "openid.realm": new URL(callback).origin,
    "openid.identity": SteamOpenId.IdentifierSelect,
    "openid.claimed_id": SteamOpenId.IdentifierSelect,
  }).toString();
  return url.toString();
};

/**
 * The SteamID64 from Steam's answer, or null when it isn't one: it must come back to the URL we
 * gave, from Steam's endpoint, and Steam must confirm the signature (which also burns the nonce).
 */
export const verifySteamLogin = async (
  params: Record<string, string | undefined>,
  callback: string,
): Promise<string | null> => {
  if (params["openid.mode"] !== OpenIdMode.IdRes) return null;
  if (params["openid.op_endpoint"] !== SteamOpenId.Endpoint) return null;
  // Steam signs return_to; it carries our state, so compare without the query string
  const returnTo = params["openid.return_to"];
  if (!returnTo || returnTo.split("?")[0] !== callback.split("?")[0]) return null;
  const match = CLAIMED_ID.exec(params["openid.claimed_id"] ?? "");
  if (!match) return null;

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith("openid.") && value !== undefined) body.set(key, value);
  }
  body.set("openid.mode", OpenIdMode.CheckAuthentication);
  const response = await fetch(SteamOpenId.Endpoint, {
    method: HttpMethod.Post,
    headers: { [HttpHeader.ContentType]: MimeType.FormUrlencoded },
    body,
  });
  const text = await response.text();
  return /^is_valid\s*:\s*true$/m.test(text) ? match[1] : null;
};
