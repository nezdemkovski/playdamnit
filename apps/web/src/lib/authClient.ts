import { passkeyClient } from "@better-auth/passkey/client";
import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getConfig } from "@/config";

export const authClient = createAuthClient({
  baseURL: getConfig().betterAuthUrl,
  plugins: [passkeyClient(), usernameClient()],
});

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>["data"]
>["user"];
