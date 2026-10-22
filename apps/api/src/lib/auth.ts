import { revokeAppleForDeletion } from "@/modules/user/appleDeletion";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createEmailVerificationToken } from "better-auth/api";
import { username, admin, openAPI, emailOTP } from "better-auth/plugins";
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
import { changeEmail, deleteAccount, resetPassword, verifyEmail } from "@playdamnit/emails";

import { emailEnabled, sendEmail } from "@/utils/email";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/utils/limits";
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

// Links and the logo in the emails point at the site, which serves the API under /api
const siteUrl = betterAuthUrl ? new URL(betterAuthUrl).origin : undefined;

// What a verification token (a JWT Better Auth signs) is for; read only to pick the email
const tokenClaims = (token: string): { requestType?: string } => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
  } catch {
    return {};
  }
};

const SESSION_COOKIE_CACHE_SECONDS = 5 * 60;

// The confirmation email's link and code both last a day
const CONFIRMATION_SECONDS = 24 * 60 * 60;

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
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    resetPasswordTokenExpiresIn: 1 * 60 * 60 * 1000, // 1 hour
    verifyEmailTokenExpiresIn: CONFIRMATION_SECONDS * 1000,
    // No email configured: accounts are usable right after sign-up and reset is unavailable
    requireEmailVerification: emailEnabled,
    ...(emailEnabled && {
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({ to: user.email, ...(await resetPassword({ url, siteUrl })) });
      },
    }),
  },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    // Signing in before the address is confirmed sends a fresh link (the first may have expired)
    sendOnSignIn: emailEnabled,
    autoSignInAfterVerification: true,
    ...(emailEnabled && {
      // The same hook sends the last link of an email change (to the new address); its token says so
      sendVerificationEmail: async ({ user, url, token }) => {
        const changing = tokenClaims(token).requestType === "change-email-verification";
        await sendEmail({
          to: user.email,
          ...(await (changing
            ? changeEmail({ url, newEmail: user.email, step: "new", siteUrl })
            : verifyEmail({ url, code: await confirmationCode(user.email), siteUrl }))),
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
    // An expiring confirmation link also works for Apple/passkey accounts without passwords.
    // Better Auth consumes the one-time token before deleting the account and its sessions.
    deleteUser: {
      enabled: true,
      deleteTokenExpiresIn: 60 * 60,
      beforeDelete: async (user) => {
        await revokeAppleForDeletion(user.id);
      },
      ...(emailEnabled && {
        sendDeleteAccountVerification: async ({ user, url }) => {
          const apple = await db.query.account.findFirst({
            where: { userId: user.id, providerId: SocialProvider.Apple },
            columns: { id: true },
          });
          await sendEmail({
            to: user.email,
            ...(await deleteAccount({ url, siteUrl, appleConnected: !!apple })),
          });
        },
      }),
    },
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
            ...(await changeEmail({ url, newEmail, step: "current", siteUrl })),
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
    // Only for confirming an address: the confirmation email carries a code next to its link, for
    // the apps to type (or autofill from Mail). Signing in or up by code stays off.
    emailOTP({
      expiresIn: CONFIRMATION_SECONDS,
      disableSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (!emailEnabled || type !== "email-verification") return;
        const token = await createEmailVerificationToken(
          process.env.BETTER_AUTH_SECRET ?? "",
          email,
          undefined,
          CONFIRMATION_SECONDS,
        );
        const url = `${betterAuthUrl}/api/auth/verify-email?token=${token}&callbackURL=%2F`;
        await sendEmail({ to: email, ...(await verifyEmail({ url, code: otp, siteUrl })) });
      },
    }),
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

/** A fresh code for the confirmation email, stored by the email OTP plugin */
function confirmationCode(email: string): Promise<string> {
  return auth.api.createVerificationOTP({ body: { email, type: "email-verification" } });
}
