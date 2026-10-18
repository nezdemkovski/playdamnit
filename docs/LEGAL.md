# Public policies

Public routes: `/privacy`, `/terms`, `/support`. They require no account. The site footer,
web registration, iOS welcome screen, registration and Settings link to the same documents.
Public operator/contact details are centralized in `apps/web/src/lib/legal.ts`.
English policy text is in the `legal` i18n namespace; one reading component renders all pages.

## Drafting sources and scope

The GDPR and terms templates of App Privacy Policy Generator were used as a topic checklist:
https://github.com/nisrulz/app-privacy-policy-generator/blob/master/src/tpl/privacy-gdpr.html
https://github.com/nisrulz/app-privacy-policy-generator/blob/master/src/tpl/tnc-simple.html
No generator application code or template text is incorporated in the product. The documents
are independently written around this service's actual data flows; no personal data was sent
to a generator. A generator is not a legal review or proof of compliance.

Operator identity, IČO, address and support email were provided by the owner on 18 October 2026.
The support inbox must be operational before publication. No third-party account or paid legal
subscription was created. Do not change the owner or email in multiple policy paragraphs.

## Implementation evidence

- Account, sessions/IP/user agent, social content, Steam metadata, avatar: `packages/db/src/schema.ts`.
- Email/password, Apple, passkeys, deletion: `apps/api/src/lib/auth.ts`.
- Account emails via Resend: `apps/api/src/utils/email.ts`.
- Sentry diagnostics and server logs: `apps/api/src/utils/enhancedLogger.ts`; iOS `CrashReporting.swift`.
- AI assistant entry points and API route registration are disabled. The implementation remains in the repository for a possible future return; OpenAI is not listed as an active feature in the public policy. Re-enable only with an updated policy and verified data controls.
- Steam connection/import: `apps/api/src/modules/steam/`; IGDB/Twitch image URLs in game responses.
- YouTube media: `apps/web/src/components/media-lightbox.tsx` and iOS `VideoEmbed.swift`.
- Session cookies: Better Auth; local view preferences: web `library-list.tsx`; iOS preferences and cached user: `SessionStore.swift` / `AppAppearance`.
- Account deletion cascades through account-owned rows. The app's password-only deletion flow
  currently requires an email support alternative for Apple users; the policy describes this
  limitation rather than promising an unsupported in-app flow.

## Provider and retention checks — 18 October 2026

- Live Resend API: `playdamnit.com` verified, sending region `eu-west-1`. `/usage`
  reports daily limit 100 and monthly limit 3000 (Free sending tier). No recipient data read.
  Resend documents 30-day email/log retention on Free/Pro/Scale and 7-day backup retention.
  Sending from Europe does not move stored email data out of the US. Its DPA is incorporated
  automatically, with SCCs: https://resend.com/security/gdpr .
- Live CloudNativePG Cluster: `retentionPolicy: 30d`; daily ScheduledBackup at 01:30 UTC.
  Latest completed backup: 2026-10-18 01:38:21 UTC. This is a recovery window, not a guarantee
  every copy disappears exactly 30 days after its creation; base backups/WAL can outlive it.
- API/librarian file logs rotate at `14d` in code; deployments have no persistent log volume.
  This does not establish the retention of Sentry events, stdout or Cloudflare records.
- Sentry account retention, region and DPA acceptance were not established. Browser sign-in
  did not complete; do not insert a guessed 30/90-day period or claim acceptance.
  https://www.sentry.help/en/articles/13965008-how-do-i-sign-your-data-processing-addendum
- Cloudflare and OpenAI dashboards required human verification. No challenge was automated.
  Cloudflare's DPA is incorporated into subscription terms, but zone plan, enabled logging
  products and Logpush destinations were not established. No blanket retention is stated.
  https://www.cloudflare.com/cloudflare-customer-dpa/ .
- Owner confirmed AI is not currently used and requested hiding it. Navigation/dialog loading
  and API route registration are disabled together. No OpenAI settings were changed.
- No provider settings changed, agreements signed, emails sent, or user data deleted.

The public policy distinguishes verified retention settings from provider-specific policies.
It does not claim that uninstalling deletes server data or that all backup copies disappear
immediately. Verify Sentry's actual DPA acceptance before public release; documentation alone
is not proof it was accepted in the account. Do not treat a generator as legal approval.

The app and site now have shared Report/Block actions on profiles, reviews and lists, block
management in Settings → Safety and a web-only admin page at `/admin/moderation`
with the report queue, decision history and account restoration. Automated checks reject a
narrow set of clearly prohibited text; reports still require human review. Account deletion
uses Better Auth's one-hour, single-use email confirmation, including for passwordless accounts.
The app handles the confirmation as a Universal Link with its own authenticated session.
Available Apple tokens are revoked before deletion; legacy ID-token-only accounts receive
manual disconnect instructions in the email, as described by Apple's TN3194.

See `MODERATION.md` and the iOS repository's `docs/app-privacy.md`. App Store Connect answers
were published on 18 October 2026 after explicit owner confirmation. The confirmed owner
account `nezdemkovski` is the only production admin. Production migrations and deployment
remain separate publication steps. No real account was deleted or reported during UI checks.

Before shipping a change to data collection, update these documents and their revision date.
