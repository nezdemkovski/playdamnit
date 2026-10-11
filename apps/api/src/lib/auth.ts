import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin, openAPI } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";

import {
  db,
  user,
  session,
  account,
  verification,
  passkey as passkeyTable,
  apikey,
} from "@/db/postgres";
import { getConfig } from "@/config";
import {
  changeEmailTemplate,
  emailEnabled,
  resetPasswordEmailTemplate,
  sendEmail,
  sendVerificationEmailTemplate,
} from "@/utils/email";

const { trustedOrigins, isDev, betterAuthUrl } = getConfig();

// WebAuthn ties passkeys to the site's hostname (rpID) and accepts registrations only from the
// listed browser origins: the web app's origins plus this API's own
const DEV_WEB_ORIGINS = ["http://localhost:3000", "http://localhost:3030"];
const rpID = betterAuthUrl ? new URL(betterAuthUrl).hostname : "localhost";
const passkeyOrigins = [
  ...new Set([
    ...(betterAuthUrl ? [new URL(betterAuthUrl).origin] : []),
    ...trustedOrigins,
    ...(isDev ? DEV_WEB_ORIGINS : []),
  ]),
];

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
    // No email configured: accounts are usable right after sign-up and reset is unavailable
    requireEmailVerification: emailEnabled,
    ...(emailEnabled && {
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset Your Password - playdamnit.com",
          html: resetPasswordEmailTemplate(url),
        });
      },
    }),
  },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    autoSignInAfterVerification: true,
    ...(emailEnabled && {
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Verify Your Email - playdamnit.com",
          html: sendVerificationEmailTemplate(url),
        });
      },
    }),
  },
  user: {
    // Password-confirmed, immediate; every row that references the user cascades
    deleteUser: { enabled: true },
    changeEmail: {
      enabled: true,
      // Without email the new address is applied directly (accounts are never verified then)
      updateEmailWithoutVerification: !emailEnabled,
      ...(emailEnabled && {
        sendChangeEmailVerification: async ({
          user,
          newEmail,
          url,
        }: {
          user: { email: string };
          newEmail: string;
          url: string;
        }) => {
          await sendEmail({
            to: user.email,
            subject: "Confirm your new email - playdamnit.com",
            html: changeEmailTemplate(newEmail, url),
          });
        },
      }),
    },
  },
  plugins: [
    username(),
    passkey({ rpID, rpName: "PlayDamnIt", origin: passkeyOrigins }),
    admin(),
    apiKey(),
    openAPI(),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: betterAuthUrl,
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
