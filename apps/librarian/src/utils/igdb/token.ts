import { createLogger } from "../enhancedLogger";
import { HttpMethod, OAuthGrantType, LogNamespace } from "../enums";

const logger = createLogger(LogNamespace.IgdbToken);

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
// Concurrent workers share one in-flight token request
let pendingToken: Promise<string> | null = null;

export const getIGDBToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  pendingToken ??= requestNewToken()
    .then(({ token, expiresAt }) => {
      cachedToken = token;
      tokenExpiresAt = expiresAt;
      return token;
    })
    .finally(() => {
      pendingToken = null;
    });

  return pendingToken;
};

export const invalidateIGDBToken = () => {
  cachedToken = null;
  tokenExpiresAt = 0;
};

const requestNewToken = async (): Promise<{ token: string; expiresAt: number }> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Twitch API credentials");
  }

  try {
    const tokenUrl = "https://id.twitch.tv/oauth2/token";
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: OAuthGrantType.ClientCredentials,
    });

    const response = await fetch(tokenUrl, { method: HttpMethod.Post, body: params });

    if (!response.ok) {
      throw new Error(`Twitch token request failed with ${response.status}`);
    }

    const { access_token, expires_in } = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    const token = `Bearer ${access_token}`;
    // Expire 5 minutes early to avoid race conditions
    const expiresAt = Date.now() + (expires_in - 300) * 1000;

    logger.info("IGDB token refreshed successfully");
    return { token, expiresAt };
  } catch (error: unknown) {
    logger.exception(error, {
      context: "IGDB",
      operation: "requestNewToken",
    });
    throw new Error("Failed to get IGDB access token", { cause: error });
  }
};
