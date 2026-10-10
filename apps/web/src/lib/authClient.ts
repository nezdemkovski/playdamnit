import { passkeyClient } from "@better-auth/passkey/client";
import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getConfig } from "@/config";

const { betterAuthUrl } = getConfig();

export const authClient = createAuthClient({
  baseURL: betterAuthUrl,
  plugins: [passkeyClient(), usernameClient()],
});
