import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { getConfig } from "@/config";

const { betterAuthUrl, betterAuthSecret } = getConfig();

export const authClient = createAuthClient({
  baseURL: betterAuthUrl,
  secret: betterAuthSecret,
  plugins: [passkeyClient(), usernameClient()],
});
