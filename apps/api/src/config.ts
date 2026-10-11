const isDev = process.env.NODE_ENV === "development";
const postgresUrl = process.env.POSTGRES_URL;
const trustedOrigins =
  process.env.TRUSTED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";
const resendApiKey = process.env.RESEND_API_KEY;
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
// Public URL of this API; Better Auth derives callback links and the passkey relying party from it
const betterAuthUrl = process.env.BETTER_AUTH_URL || (isDev ? "http://localhost:3030" : undefined);
// Shared with the librarian, which registers the webhooks with IGDB
const igdbWebhookSecret = process.env.IGDB_WEBHOOK_SECRET;

const config = {
  isDev,
  trustedOrigins,
  postgresUrl,
  openaiApiKey,
  openaiModel,
  resendApiKey,
  betterAuthSecret,
  betterAuthUrl,
  igdbWebhookSecret,
};

export const getConfig = () => {
  return config;
};
