import type { RenderedEmail } from "@playdamnit/emails";
import { Resend } from "resend";

import { getConfig } from "@/config";

const { resendApiKey, emailFrom, isDev } = getConfig();

// The Resend constructor throws without a key, so only create it when one is configured
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Without a key the API runs without email: sign-up needs no verification and password
// reset is off (see src/lib/auth.ts). In development they are logged, and sent for real only
// when a key is set in .env (to try them in an inbox).
export const emailEnabled = !!resend || isDev;

// The templates live in @playdamnit/emails (React Email); `bun run --cwd packages/emails dev`
// previews them
export const sendEmail = async ({ to, subject, html, text }: { to: string } & RenderedEmail) => {
  if (isDev) {
    console.log("==== Development Mode Email ====");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Text:", text);
    console.log("==============================");
  }

  if (!resend) {
    if (isDev) return;
    throw new Error("RESEND_API_KEY is not set, cannot send email");
  }

  return resend.emails.send({
    from: emailFrom,
    to,
    subject,
    html,
    text,
  });
};
