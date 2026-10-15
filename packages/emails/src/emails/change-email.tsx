import { Data, Layout, Paragraph } from "../components/layout";
import { defaultSiteUrl } from "../theme";

export type ChangeEmailProps = {
  url: string;
  newEmail: string;
  /** "current": the first link, to the address in use; "new": the last one, to the new address */
  step: "current" | "new";
  siteUrl?: string;
};

/** Moving the account to another address: the old one says yes, then the new one confirms */
export default function ChangeEmail({
  url,
  newEmail,
  step,
  siteUrl = defaultSiteUrl,
}: ChangeEmailProps) {
  if (step === "new") {
    return (
      <Layout
        siteUrl={siteUrl}
        preview="Last step: confirm this is your new address."
        eyebrow="New address"
        heading="Last step."
        action="Confirm new email"
        url={url}
        note="The link works for 24 hours. Didn't ask for this? Ignore it and nothing changes."
      >
        <Paragraph>
          Confirm <Data>{newEmail}</Data> as the new address of your account. Same backlog, new
          inbox.
        </Paragraph>
      </Layout>
    );
  }
  return (
    <Layout
      siteUrl={siteUrl}
      preview={`You asked to move your account to ${newEmail}.`}
      eyebrow="Change your email"
      heading="New address, same backlog."
      action="Confirm the change"
      url={url}
      note="Didn't ask for this? Ignore it: your email stays as it is. Changing your password wouldn't hurt either."
    >
      <Paragraph>
        You asked to move your account to <Data>{newEmail}</Data>. Confirm it's you, then check the
        new inbox: we'll ask it to confirm too.
      </Paragraph>
    </Layout>
  );
}

ChangeEmail.PreviewProps = {
  url: `${defaultSiteUrl}/api/auth/verify-email?token=preview&callbackURL=%2F`,
  newEmail: "you@example.com",
  step: "current",
} satisfies ChangeEmailProps;
