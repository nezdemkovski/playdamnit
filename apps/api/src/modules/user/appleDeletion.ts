import { db } from "@/db/postgres";
import { getConfig } from "@/config";
import { AuthProviderId, HttpMethod, MimeType } from "@/utils/enums";

enum AppleEndpoint {
  Revoke = "https://appleid.apple.com/auth/revoke",
}
enum AppleTokenHint {
  Refresh = "refresh_token",
  Access = "access_token",
}

export async function revokeAppleToken(
  input: {
    clientId: string;
    clientSecret: string;
    refreshToken?: string | null;
    accessToken?: string | null;
  },
  send: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<boolean> {
  const token = input.refreshToken || input.accessToken;
  if (!token || !input.clientSecret) return false;
  const response = await send(AppleEndpoint.Revoke, {
    method: HttpMethod.Post,
    headers: { "content-type": MimeType.FormUrlencoded },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      token,
      token_type_hint: input.refreshToken ? AppleTokenHint.Refresh : AppleTokenHint.Access,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  // Do not put provider bodies, tokens or client secrets into error messages/logs.
  if (!response.ok) throw new Error("Apple authorization revocation failed");
  return true;
}

/** Run while account credentials still exist. Legacy native sign-ins have only an ID token;
 * Apple's TN3194 requires deletion to remain available and explains manual revocation then.
 */
export async function revokeAppleForDeletion(userId: string) {
  const accounts = await db.query.account.findMany({
    where: { userId, providerId: AuthProviderId.Apple },
  });
  const config = getConfig();
  for (const account of accounts) {
    await revokeAppleToken({
      clientId: config.appleClientId ?? config.appleAppBundleId,
      clientSecret: config.appleClientSecret ?? "",
      refreshToken: account.refreshToken,
      accessToken: account.accessToken,
    });
  }
}
