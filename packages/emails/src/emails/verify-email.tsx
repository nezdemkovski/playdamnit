import { Code, Layout, Paragraph } from "../components/layout";
import { defaultSiteUrl } from "../theme";

export type VerifyEmailProps = { url: string; code: string; siteUrl?: string };

/** Sent on sign-up, and again when someone signs in before confirming: a code to type in the
 * app and a link that does the same */
export default function VerifyEmail({ url, code, siteUrl = defaultSiteUrl }: VerifyEmailProps) {
  return (
    <Layout
      siteUrl={siteUrl}
      preview={`Your code is ${code}. The backlog isn't going anywhere.`}
      eyebrow="Confirm your email"
      heading="Prove you're real."
      action="Confirm email"
      url={url}
      note="The code and the link work for 24 hours. Didn't sign up? Ignore this and nothing happens."
    >
      <Paragraph>
        Someone (hopefully you) just made an account with this address. Confirm it and start logging
        the games you swear you'll get to.
      </Paragraph>
      <Code label="Your code" code={code} />
    </Layout>
  );
}

VerifyEmail.PreviewProps = {
  url: `${defaultSiteUrl}/api/auth/verify-email?token=preview&callbackURL=%2F`,
  code: "482913",
} satisfies VerifyEmailProps;
