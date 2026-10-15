import { Layout, Paragraph } from "../components/layout";
import { defaultSiteUrl } from "../theme";

export type ResetPasswordProps = { url: string; siteUrl?: string };

export default function ResetPassword({ url, siteUrl = defaultSiteUrl }: ResetPasswordProps) {
  return (
    <Layout
      siteUrl={siteUrl}
      preview="Pick a new password and get back to judging."
      eyebrow="Reset your password"
      heading="Forgot it. Happens."
      action="Set a new password"
      url={url}
      note="The link works for 1 hour. Didn't ask for this? Ignore it: your password stays the same."
    >
      <Paragraph>Pick a new password for your account and get back to judging.</Paragraph>
    </Layout>
  );
}

ResetPassword.PreviewProps = {
  url: `${defaultSiteUrl}/api/auth/reset-password/preview?callbackURL=%2F`,
} satisfies ResetPasswordProps;
