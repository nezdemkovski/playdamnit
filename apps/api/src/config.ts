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
// Shared with the librarian, which registers the webhooks with IGDB
const igdbWebhookSecret = process.env.IGDB_WEBHOOK_SECRET;
// Ask the librarian to search IGDB when a first page is thin. Only until the catalog is a full
// mirror; off by default.
const searchIgdbFallback = process.env.SEARCH_IGDB_FALLBACK === "true";

const config = {
  isDev,
  trustedOrigins,
  postgresUrl,
  openaiApiKey,
  openaiModel,
  resendApiKey,
  betterAuthSecret,
  igdbWebhookSecret,
  searchIgdbFallback,
};

export const getConfig = () => {
  return config;
};
