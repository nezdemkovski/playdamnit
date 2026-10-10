import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin, openAPI } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey"

import { db, user, session, account, verification, passkey as passkeyTable, apikey } from "@/db/postgres";
import { getConfig } from "@/config";
import {
  resetPasswordEmailTemplate,
  sendEmail,
  sendVerificationEmailTemplate,
} from "@/utils/email";

const { trustedOrigins, isDev } = getConfig();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    // Drizzle v1 clients are built from relations, so the adapter needs the tables explicitly
    schema: { user, session, account, verification, passkey: passkeyTable, apikey },
  }),
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 1 * 60 * 60 * 1000, // 1 hour
    verifyEmailTokenExpiresIn: 24 * 60 * 60 * 1000, // 24 hours
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset Your Password - playdamnit.com",
        html: resetPasswordEmailTemplate(url),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email - playdamnit.com",
        html: sendVerificationEmailTemplate(url),
      });
    },
  },
  plugins: [username(), passkey(), admin(), apiKey(), openAPI()],
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (request) => {
    if (!request) return [];

    const origin = request.headers.get("origin");

    if (!origin) return [];

    if (isDev && origin.startsWith("http://localhost")) {
      return [origin];
    }

    if (trustedOrigins.includes(origin)) {
      return [origin];
    }

    return [];
  },
});
