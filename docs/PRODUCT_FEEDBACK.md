# Shared release history and feedback

`GET /api/changelog?locale=ru&platform=ios` is public. Optional `locale` falls back to
English, and `platform` is `all`, `web` or `ios`. Add releases and translated member-facing
features to `apps/api/src/modules/product/changelog.ts`; web and iOS read this source.
Both clients retain their bundled initial release if the endpoint is unavailable.

`POST /api/feedback` requires an existing signed-in account. Body:

```json
{
  "requestId": "ff8f2400-3ed0-463b-a501-c4870ef3691a",
  "kind": "bug",
  "title": "Library problem",
  "message": "My games are missing",
  "platform": "ios",
  "appVersion": "1.0.1 (99)",
  "locale": "ru"
}
```

Clients show one message field and derive the Linear title from its opening text.
The existing request contract still includes `title` for compatibility.

`kind` is `bug` or `feature`; `title` allows 1–160 characters and `message` 1–5000,
with whitespace-only values rejected. `appVersion` and `locale` are optional.
Ten requests per account per hour are allowed per API process. Only the server receives
`LINEAR_API_KEY`, `LINEAR_TEAM_ID` and `LINEAR_PROJECT_ID`. The key needs Read and Create
issues access to the destination team. Optional `LINEAR_ASSIGNEE_ID` assigns feedback to its owner. Do not put credentials in browser/mobile builds.

Success returns HTTP 201 with an opaque `id`; no private issue URL or Linear response
is exposed. The issue includes the submitted text, username, platform, optional version
and language; the form explains this. No email address or session/token is sent.
The server deterministically derives a Linear UUID from account ID and request ID.
Retries reuse that UUID, including when Linear accepted a request before a timeout;
clients retain drafts on failure and change request IDs when the draft changes.
Provider failure or missing configuration returns 503. There is no silent local queue:
a successful acknowledgement means Linear has confirmed the issue.

## Compatibility verification

The new operations and schema names are additive. No existing endpoint, schema, enum,
authentication behavior or request shape changes. `tests/released-contract.test.ts`
compares every preexisting operation/schema to canonical hashes of product commit
`816f80d636cef6bbd057913fc70392e1e4424f39` (0.1.62), including the newly shipped
changelog/feedback contracts used by native build 100. The preceding 0.1.59 operations
and schemas were separately verified unchanged in this rollout. Keep this guard; future compatible
contract extensions require original-client verification before updating its baseline.

App Store Connect was checked on 22 October 2026: public App Store 1.0 (84) is Ready for
Sale, source `c7bcaf6af48ceed444584f46253e1d56113de898`. TestFlight includes 1.0.1 builds
90–98 (plus 95.1.1/95.2.1), and build 99 was uploaded successfully from
`06f8a887297009b71929340f4441631e4c264ff6`. App Store 84's original generated client,
without regenerating its models, is used against live populated/null, empty, catalog
and not-found responses before and after deployment. Existing API integration tests
exercise previous request shapes; these new endpoints are never called by old clients.
New clients handle an older/rolled-back server: changelog keeps its bundled history,
and feedback preserves its draft and shows a retryable error on an unavailable route.

Roll out the API before publishing the updated native client. Image publication, Flux
readiness and live HTTP checks are distinct steps. Validate feedback with a clearly
marked test submission in the product project, then cancel the test issue.

### Verified rollout — 22 October 2026

- Product source `816f80d636cef6bbd057913fc70392e1e4424f39` (0.1.62): CI and image/chart publication succeeded.
- GitOps source `f31f8b9`: all three HelmReleases Ready; all deployments use pinned 0.1.62 digests; ExternalSecret Ready.
- Live localized changelog responds successfully; anonymous feedback is rejected with 401.
- Production feedback service created verification issue NEZ-60 in Play, damn it!, assigned to Yuri. A repeat returned the same receipt and created no duplicate. The verification issue was canceled.
- Original App Store 1.0 (84) client decoded populated/null, empty, catalog and 404 responses after rollout. The iOS repo includes a reproducible `scripts/check-released-api.py` that extracts original generated sources and their original dependency lockfile.
- Local server suite: 35 passed, 101 DB-dependent tests skipped; CI's PostgreSQL-backed suite passed. Native suite: 95 model tests passed; single-field feedback retry and shared changelog passed UI tests. Web form and retry verified in an isolated browser against mock responses; actual provider delivery verified separately in production.
