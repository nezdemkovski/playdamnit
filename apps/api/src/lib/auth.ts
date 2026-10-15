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
import { isValidUsername, USERNAME_MAX, USERNAME_MIN } from "@/modules/user/username";
import {
  changeEmailTemplate,
  emailEnabled,
  resetPasswordEmailTemplate,
  sendEmail,
  sendVerificationEmailTemplate,
} from "@/utils/email";
import { Hostname, Origin, SocialProvider } from "@/utils/enums";

const { trustedOrigins, isDev, betterAuthUrl, appleAppBundleId, appleClientId, appleClientSecret } =
  getConfig();

// WebAuthn ties passkeys to the site's hostname (rpID) and accepts registrations only from the
// listed browser origins: the web app's origins plus this API's own
const DEV_WEB_ORIGINS = ["http://localhost:3000", "http://localhost:3030"];
const rpID = betterAuthUrl ? new URL(betterAuthUrl).hostname : Hostname.Localhost;
const passkeyOrigins = [
  ...new Set([
    ...(betterAuthUrl ? [new URL(betterAuthUrl).origin] : []),
    ...trustedOrigins,
    ...(isDev ? DEV_WEB_ORIGINS : []),
  ]),
];

const SESSION_COOKIE_CACHE_SECONDS = 5 * 60;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    // Drizzle v1 clients are built from relations, so the adapter needs the tables explicitly
    schema: { user, session, account, verification, passkey: passkeyTable, apikey },
  }),
  // The session rides in a signed cookie for five minutes, so the API's own routes skip the
  // database lookup per request; Better Auth's sensitive endpoints (password, email, account
  // deletion) still check the database. A session revoked elsewhere stops working within that.
  session: {
    cookieCache: { enabled: true, maxAge: SESSION_COOKIE_CACHE_SECONDS },
  },
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
  // Sign in with Apple: the iOS app's ID tokens (audience: its bundle ID) always; the web's
  // redirect flow only with a Services ID and its secret
  socialProviders: {
    apple: {
      clientId: appleClientId ?? appleAppBundleId,
      clientSecret: appleClientSecret ?? "",
      appBundleIdentifier: appleAppBundleId,
      audience: [appleAppBundleId, ...(appleClientId ? [appleClientId] : [])],
    },
  },
  // Apple verifies the address, so signing in with Apple joins an account with the same email
  account: {
    // A signed-in member linking Apple from settings may use a different address ("Hide My
    // Email" relays never match); signing in with Apple still joins only the same email
    accountLinking: { trustedProviders: [SocialProvider.Apple], allowDifferentEmails: true },
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
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: isValidUsername,
    }),
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

    if (isDev && origin.startsWith(Origin.LocalhostHttp)) {
      return [origin];
    }

    if (trustedOrigins.includes(origin)) {
      return [origin];
    }

    // The web's Sign in with Apple posts back from Apple
    if (appleClientId && origin === Origin.Apple) {
      return [origin];
    }

    return [];
  },
});
