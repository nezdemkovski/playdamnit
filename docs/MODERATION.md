# Moderation

The same API serves the app and web UI. No automatic bans or crowd-voting thresholds.

- A signed-in member can report another profile, review or list, and block its author.
- A report captures up to 2,000 characters for the private moderator queue, is deduplicated
  per reporter/content and rate-limited. It never removes content by itself.
- Blocks hide the two accounts from each other, remove mutual follows and notifications,
  and prevent new interactions. Everyone else retains the normal view, subject to privacy.
- Settings → Safety lets members unblock. Moderation management is web-only at
  `/admin/moderation`, linked from the sidebar and account settings for administrators.
  The iOS app has no report queue or global moderation controls.
- Moderators can dismiss, remove a review/list, or suspend the author. Removing a review
  retains its library entry. The page includes pending reports, decision history and suspended
  accounts. Restoring access never restores revoked sessions. Admin accounts cannot be
  suspended through the report queue.
- Suspensions revoke sessions; protected routes verify the session against the DB, while
  public viewer routes still use the normal cookie cache. Public visibility checks exclude
  suspended accounts independently of that cache. Every administrative read/write checks the
  current DB role. Report and account pages are bounded to 50 items, with pagination.
- Reports need a human response. Check the queue regularly; handle urgent safety reports
  promptly and appeals via support@nezdemkovski.com. The filter is a minimal guard for clear
  prohibited text, not a claim of complete multilingual or image classification.

Tables: `user_block`, `content_report`; indexed foreign keys and queue status/time. Reports
about a deleted account cascade; a deleted reporter/moderator is de-identified with SET NULL.
Do not expose the queue or its context publicly. Do not give a user admin rights based solely
on a matching display name. Production moderator provisioning must identify the exact account.

Local integration tests use `playdamnit_moderation_test`, never the working or production DB.
They verify bilateral block vs third-party visibility, privacy preservation, report deduplication,
authorization and content removal. Account-deletion tests intercept the email callback and
send no real mail. Production migrations/deployment were not run during implementation.

## Owner provisioning

On 18 October 2026, the owner confirmed username `nezdemkovski`. A bounded production
transaction promoted that exact existing account and verified it is the only `admin`.
No other production account roles were changed. Deployment of this page remains separate
from that role update; no role-management UI is exposed.
