import { Layout, Paragraph } from "../components/layout";
import { defaultSiteUrl } from "../theme";

export type VerifyEmailProps = { url: string; siteUrl?: string };

/** Sent on sign-up, and again when someone signs in before confirming */
export default function VerifyEmail({ url, siteUrl = defaultSiteUrl }: VerifyEmailProps) {
  return (
    <Layout
      siteUrl={siteUrl}
      preview="One tap and you're in. The backlog isn't going anywhere."
      eyebrow="Confirm your email"
      heading="Prove you're real."
      action="Confirm email"
      url={url}
      note="The link works for 24 hours. Didn't sign up? Ignore this and nothing happens."
    >
      <Paragraph>
        Someone (hopefully you) just made an account with this address. Confirm it and start logging
        the games you swear you'll get to.
      </Paragraph>
    </Layout>
  );
}

VerifyEmail.PreviewProps = {
  url: `${defaultSiteUrl}/api/auth/verify-email?token=preview&callbackURL=%2F`,
} satisfies VerifyEmailProps;
