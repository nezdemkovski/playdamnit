import { Hostname, NodeEnv, OpenAiModel } from "@/utils/enums";

const isDev = process.env.NODE_ENV === NodeEnv.Development;
const postgresUrl = process.env.POSTGRES_URL;
const trustedOrigins =
  process.env.TRUSTED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || OpenAiModel.Gpt4o;
const resendApiKey = process.env.RESEND_API_KEY;
// The sender of the account emails; its domain must be verified in Resend
const emailFrom = process.env.EMAIL_FROM || "Play, damn it! <noreply@playdamnit.com>";
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
// Public URL of this API; Better Auth derives callback links and the passkey relying party from it
const betterAuthUrl = process.env.BETTER_AUTH_URL || (isDev ? "http://localhost:3030" : undefined);
// Shared with the librarian, which registers the webhooks with IGDB
const igdbWebhookSecret = process.env.IGDB_WEBHOOK_SECRET;
// Steam Web API key for the library import; without it the import is off
const steamApiKey = process.env.STEAM_API_KEY;
// Sign in with Apple. The iOS app signs in natively with an ID token issued for its bundle ID,
// which needs no secret. The web's redirect flow also needs a Services ID and its client
// secret (a JWT signed with the Sign in with Apple key); without them only the app offers Apple.
const appleAppBundleId = process.env.APPLE_APP_BUNDLE_ID || "cloud.nezdemkovski.playdamnit";
const appleClientId = process.env.APPLE_CLIENT_ID;
const appleClientSecret = process.env.APPLE_CLIENT_SECRET;

const config = {
  isDev,
  trustedOrigins,
  postgresUrl,
  openaiApiKey,
  openaiModel,
  resendApiKey,
  emailFrom,
  betterAuthSecret,
  betterAuthUrl,
  igdbWebhookSecret,
  steamApiKey,
  appleAppBundleId,
  appleClientId,
  appleClientSecret,
  linearApiKey: process.env.LINEAR_API_KEY,
  linearTeamId: process.env.LINEAR_TEAM_ID,
  linearProjectId: process.env.LINEAR_PROJECT_ID,
};

export const getConfig = () => {
  return config;
};
