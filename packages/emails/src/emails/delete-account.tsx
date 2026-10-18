import { Link } from "react-email";
import { Layout, Paragraph } from "../components/layout";
import { defaultSiteUrl } from "../theme";

export type DeleteAccountProps = { url: string; siteUrl?: string; appleConnected?: boolean };
export default function DeleteAccount({
  url,
  siteUrl = defaultSiteUrl,
  appleConnected = false,
}: DeleteAccountProps) {
  return (
    <Layout
      siteUrl={siteUrl}
      preview="Confirm account deletion"
      eyebrow="Delete account"
      heading="Delete your account?"
      action="Delete my account"
      url={url}
      note="This link expires in 1 hour. If you didn’t request this, ignore it. Your account stays as it is."
    >
      <Paragraph>
        This removes your account, library and social content. It cannot be undone.
      </Paragraph>
      {appleConnected && (
        <Paragraph>
          If the Apple connection remains after deletion, open{" "}
          <Link href="https://account.apple.com/">your Apple Account</Link>, choose Sign-In &amp;
          Security → Sign in with Apple, and remove Play, damn it!. This disconnects the app; it
          does not delete your Apple Account.
        </Paragraph>
      )}
    </Layout>
  );
}
