const isDev = process.env.NODE_ENV === "development";
const postgresUrl = process.env.POSTGRES_URL;
const trustedOrigins =
  process.env.TRUSTED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";
const resendApiKey = process.env.RESEND_API_KEY;
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;

const config = {
  isDev,
  trustedOrigins,
  postgresUrl,
  openaiApiKey,
  openaiModel,
  resendApiKey,
  betterAuthSecret,
};

export const getConfig = () => {
  return config;
};
