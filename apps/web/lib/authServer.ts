"use server";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { cache } from "react";
import { headers } from "next/headers";

import { getConfig } from "@/config";

// Server-side calls use BACKEND_URL (read at runtime), not the NEXT_PUBLIC_ URL inlined at
// build time: inside Docker the API isn't reachable on the browser-facing address
const { betterAuthUrl: BETTER_AUTH_URL, betterAuthSecret: BETTER_AUTH_SECRET } = getConfig();

const auth = createAuthClient({
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  plugins: [passkeyClient(), usernameClient()],
});

export const getSession = cache(async () => {
  return await auth.getSession({
    query: {
      disableCookieCache: true,
    },
    fetchOptions: {
      headers: await headers(),
    },
  });
});

export const authServer = async () => {
  return auth;
};
