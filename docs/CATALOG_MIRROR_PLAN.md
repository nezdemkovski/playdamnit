# Plan: full IGDB mirror with webhooks

Status: proposed (2026-10-11). Replaces the lazy-fill catalog (search → `search-igdb` job → wait for
NOTIFY) and the similar-games crawl currently implemented in the API and the librarian.

## Why

Today the catalog is empty until someone asks for a game. Every search can turn into
"count matches → claim `igdb_search_log` → enqueue `search-igdb` → wait up to 10s for NOTIFY → re-query".
That machinery exists only because the game may not be in Postgres yet. It brings:

- one process-global IGDB throttle shared by interactive searches and background crawls, no priorities;
- a search cooldown that is claimed _before_ IGDB answers (an IGDB outage locks queries for 7 days);
- a nightly refresh that starves on ids IGDB has deleted (they never get `updated_at` bumped);
- lookup tables (`platform`, `genre`, …) with local identity ids, so `platformId` in exports is not portable;
- a game model that keeps about a third of what IGDB returns (no alternative names, no
  developer/publisher split, no editions/DLC hierarchy, no videos, no store links).

IGDB's FAQ says local storage is allowed and preferred. The whole IGDB games table is a few hundred
thousand rows: at 500 ids per request and 4 requests/s the API side of a full load is minutes.
Two comparable products, Backloggd and mygamelist.club, both serve search from a full local copy,
never touch IGDB inside a user request, and use nearly the whole expanded game document.

## Target

- The catalog is a full copy of IGDB games (all `game_type`s), kept fresh by IGDB webhooks, with a
  daily `updated_at` delta sync as a safety net.
- Every game is stored as its full expanded IGDB document (`raw jsonb`) plus normalised columns and
  tables for everything the API searches, filters or joins on. New fields never need a re-sync.
- Search is local only, over `name` and `alternative_names`. `search-igdb`, `igdb_search_log`, the
  `fresh` flag, the "fewer than 3 matches" heuristic and the in-process dedup map are removed.
- `fetch-by-ids` + NOTIFY stays as a fallback for import and add-by-id (webhook lag).
- All catalog tables use IGDB ids. Deleted games are flagged, never removed.
- The librarian stays the only IGDB client and the only instance (the throttle is per process).

## Data model

What the two reference products show on a game page, mapped to IGDB fields. "Keep" = what we
materialise into columns/tables; everything else is still available in `raw`.

| Data                                  | IGDB field                                    | Backloggd | mygamelist | Keep      |
| ------------------------------------- | --------------------------------------------- | --------- | ---------- | --------- |
| Name, slug, summary, storyline        | `name`, `slug`, `summary`, `storyline`        | yes       | yes        | columns   |
| Alternative names (searchable)        | `alternative_names.name`                      | no        | yes        | column    |
| Release date with precision           | `first_release_date`, `release_dates`         | yes       | yes        | column    |
| Game type (badge, filter)             | `game_type`                                   | yes       | yes        | column    |
| Genres, platforms, game modes, themes | `genres`, `platforms`, `game_modes`, `themes` | yes       | yes        | tables    |
| Developer / publisher separately      | `involved_companies.{developer,publisher}`    | yes       | yes        | table     |
| Cover, localized covers               | `cover`, `game_localizations.cover`           | yes       | yes        | table     |
| Screenshots, videos                   | `screenshots`, `videos`                       | yes       | yes        | tables    |
| Store links                           | `external_games`                              | no        | yes        | table     |
| Websites                              | `websites`                                    | no        | yes        | table     |
| DLC / expansions / updates / bundles  | `parent_game` + `game_type`                   | yes       | yes        | column    |
| Editions folded into the parent       | `version_parent`                              | yes       | yes        | column    |
| Series                                | `collections`                                 | yes       | no         | table     |
| Time to beat                          | `game_time_to_beats` (own endpoint)           | yes       | no         | table     |
| Similar games                         | `similar_games`                               | no        | no         | int[]     |
| Rating, rating count                  | `total_rating`, `total_rating_count`          | yes       | yes        | columns   |
| "More on IGDB" link                   | `url`                                         | yes       | yes        | from slug |

Resulting schema (all ids are IGDB ids; `*` = new):

- `game`: existing columns + `raw jsonb`\*, `igdb_updated_at`\*, `last_synced_at`\*, `deleted_at`\*,
  `game_type`\*, `parent_game_id`\*, `version_parent_id`\*, `alternative_names text[]`\*,
  `similar_game_ids integer[]`\*, `total_rating_count`\*, `first_release_date_precision`\*,
  `search_names text` generated\* (`name || ' ' || array_to_string(alternative_names, ' ')`, trigram-indexed).
  `involved_companies` and `keywords` text columns go away (companies become a table, keywords
  stay in `raw`).
- Lookups: `platform`, `genre`, `game_mode`, `theme`\*, `type` (kept for the `game_type` enum names),
  `website_type`, `company`\*, `collection`\*.
- Junctions: existing `game_to_platform|genre|game_mode` + `game_to_theme`\*,
  `game_to_collection`\*, `game_to_company (game_id, company_id, developer bool, publisher bool)`\*.
  `game_to_type` goes away (`game_type` is single-valued).
- Media/links keyed by IGDB id: `cover` (+ `game_localization`\* for localized covers),
  `screenshot`, `video`\*, `website`, `external_game`\* (`external_game_source`, `uid`, `url`).
- `game_time_to_beat`\* (`game_id pk`, `hastily`, `normally`, `completely`, `count`).
- `sync_state`\* and `catalog_dirty`\* (see phases).
- Dropped later: `igdb_search_log`, `game_to_similar_game`, `game_to_type`.

Search and indexes live on columns only; `raw` is never indexed or filtered on.

## Phases

Order matters: lookup ids first, one driver, then the full load, then webhooks, and only then remove
the lazy path. Phases 1 to 5 landed on 2026-10-11.

### Phase 0. Preparation (parallel, non-blocking)

- Public HTTPS URL for the API (webhook receiver). New env: `IGDB_WEBHOOK_SECRET` (api + librarian),
  `WEBHOOK_BASE_URL` (librarian).
- "Powered by IGDB" attribution in the web footer.

### Phase 1. Schema, additive migration (`packages/db/src/schema.ts`) — done

Migration `20261011005705_catalog_mirror_phase1`:

- New `game` columns from the data model (all nullable or defaulted), `search_names` as a plain
  column the librarian writes (array expressions are not immutable, so no generated column).
- New tables: `theme`, `company`, `collection`, `external_game_source`, `game_to_theme`,
  `game_to_company`, `game_to_collection`, `video`, `external_game`, `game_localization`,
  `game_time_to_beat`, `sync_state`, `catalog_dirty`.
- Postgres 18 everywhere (dev compose, prod compose, CI; the homelab CNPG already runs 18):
  `user_games`, `user_follows`, `user_metadata` ids default to `uuidv7()`.
- `cover`, `screenshot`, `website` keep their identity ids until Phase 4: switching them needs the
  full load that rewrites those rows anyway.
- `igdb_search_log`, `game_to_similar_game`, `game_to_type` are dropped in Phase 7, not here.

### Phase 2. Lookup tables on IGDB ids — done

Done in the same migration, in one deploy, with the slug → IGDB id mapping embedded in the SQL
(platforms from igdb.com, the rest from IGDB's enum tables; 2026-10-11). The migration:

- refuses to run if a library (`user_games.platform_id`) references a platform without a known
  IGDB id, listing the slugs;
- drops the FKs, moves every reference to the negated IGDB id, deletes unmatched lookup rows and
  their junction rows (derived data, the catalog refresh brings them back), flips ids back to
  positive and re-adds the FKs;
- drops the identity from `platform`, `genre`, `game_mode`, `type`, `website_type`.

The librarian now writes lookups by IGDB id (`writeGame`) and has a `sync-lookups` queue
(`apps/librarian/src/workers/lookupsWorker.ts`): `/platforms`, `/genres`, `/game_modes`,
`/themes`, `/game_types`, `/website_types`, `/external_game_sources`, `/collections`,
`/companies` and `/game_time_to_beats` with keyset pagination, upserted by id; time-to-beat rows
are kept only for games already in the catalog. It runs daily at 03:30 and once after a deploy
(skipped when the last run is under 20 hours old). `fetchAllIGDB` in `utils/igdb/utils.ts` is the
reusable pager the bulk sync will build on.

### Phase 3. One Postgres driver — done

The API builds its Drizzle client on `bun-sql`, the librarian on `node-postgres`, the API's LISTEN
client is `node-postgres` and pg-boss brings its own pool. Before the bulk writer lands, everything
moves to `node-postgres`:

- `apps/api/db/postgres/index.ts` → `drizzle-orm/node-postgres` with one shared `pg.Pool`; the LISTEN
  client and pg-boss reuse the same connection string (pg-boss can take the pool via `db`).
- `packages/db/src/migrate.ts` → `drizzle-orm/node-postgres/migrator`.
- `apps/api/tests/setup.ts` and the integration test need no change beyond the import.
- Drop the `code || errno` dance in `isUniqueViolation` (`apps/api/src/modules/userGame/service.ts`);
  `pg` always sets `code`.

Why now: `writeGamesBatch` upserts 500 rows per statement with `jsonb` and arrays, and the two
drivers parse `numeric`, `timestamp` and arrays differently. One driver means one set of type
rules, one pool per process, and the Better Auth CLI can load `src/lib/auth.ts` again, so the auth
tables stop being mirrored by hand.

### Phase 4. Bulk sync in the librarian — done

- New queue `sync-catalog` with `{ mode: "full" | "incremental", cursor }`. One run processes a fixed
  number of pages and re-enqueues itself with the new cursor. This sidesteps pg-boss's default 15 min
  `expireIn` and makes the sync resumable after a restart.
- Keyset pagination, not offset: full → `where id > cursor; sort id asc; limit 500;`,
  incremental → `where updated_at > cursor; sort updated_at asc; limit 500;`. Cursor lives in `sync_state`.
- `GAME_FIELDS` becomes the full expanded document: `*`, `alternative_names.*`, `cover.*`,
  `screenshots.*`, `videos.*`, `websites.*`, `external_games.*`, `involved_companies.*`,
  `game_localizations.*`, `release_dates.*`, `genres.*`, `platforms.*`, `game_modes.*`, `themes.*`,
  `collections.*`, `game_type.*`, `parent_game`, `version_parent`, `similar_games`, `updated_at`.
  One level of expansion is IGDB's practical limit, and it is all we need.
- Rewrite `apps/librarian/src/workers/igdbWorker.ts`: replace per-game `writeGame` transactions with a
  batched `writeGamesBatch` — one transaction, one bulk upsert per table for 500 games
  (~20 statements instead of ~7500). The whole response row goes to `raw`; columns and child tables
  are derived from it in the same statement set. Apply `uniqueBy` to every batch: `ON CONFLICT DO
  UPDATE` fails if a statement hits the same key twice.
- Companies and collections referenced by a game but missing from the lookup tables are inserted from
  the expanded sub-object in the same transaction (name + slug), so junctions never hit a missing FK.
- `similar_games` are written to `game.similar_game_ids` (no FK). `GET /games/:id` reads the array;
  `game_to_similar_game`, the `process-similar-games` queue and `SIMILAR_GAMES_MAX_DEPTH` go away.
- Before the first full load drop `idx_game_name_trgm` (and the new `search_names` index); recreate
  them and `VACUUM ANALYZE` afterwards.
- Sizing: ~700 IGDB requests for games (minutes of API time), tens of minutes of writes. With `raw`
  and media tables the DB grows to roughly 9 GB. `raw` is TOASTed and compressed by Postgres;
  keep it out of `select *` paths in the API.

What landed (2026-10-11):

- `apps/librarian/src/catalog/derive.ts` (pure, unit-tested) and `writeGames.ts`: one transaction
  per batch, bulk upserts for lookups, games, media, links and junctions. `GAME_FIELDS` is the
  full expanded document. Slug collisions are defused by renaming the old owner's slug.
- `sync-catalog` queue (`catalogSyncWorker.ts`): full walk by id, incremental walk by
  `updated_at` with a per-second id sub-walk, 10 pages per job, cursor in `sync_state`, the
  finished full walk seeds the incremental cursor. Incremental runs daily at 02:00; a full walk
  is started with `bun run scripts/enqueue.ts sync-catalog full`.
- `process-similar-games`, `SIMILAR_GAMES_MAX_DEPTH` and the crawl are gone; `GET /games/:id`
  reads `similar_game_ids`. `refresh-stale-games` uses `last_synced_at`.
- Migration `20261011092715_catalog_mirror_phase4`: `cover`, `screenshot`, `website` keyed by IGDB
  id (tables truncated; there is no production data yet).
- API list queries exclude `raw`, `search_names` and `similar_game_ids` (`GAME_CARD_COLUMNS`).
- IGDB caps a response at 10 MB and a full game document averages ~35 KB, so expanded games are
  fetched 100 per page (`GAME_PAGE_SIZE`), halving on a 413. Measured on the dev box: ~3 s per
  page including the write, ~32 games/s, so a full walk of ~350k games takes about 3 hours and
  the `game` table lands at ~20 KB per row (~7 GB) plus ~1–2 GB of child tables. Size the
  production volume at 30Gi, not 20Gi.
- Not automated: dropping the trigram indexes before the first full walk and `VACUUM ANALYZE`
  after it. Do that by hand around the first production run.

### Phase 5. Webhooks — done

- Receiver in the API: `POST /api/webhooks/igdb/:entity/:method`. No auth macro, outside the rate
  limiters, `X-Secret` compared with `crypto.timingSafeEqual`. It resolves the event to a game id
  (`games` → `id`; `covers`, `screenshots`, `videos`, `external_games`, `involved_companies`,
  `game_localizations` → `game`) and does one `insert into catalog_dirty … on conflict do nothing`,
  then returns 200. `games`/`delete` writes reason `deleted`. It never touches catalog tables.
- Registration in the librarian on startup: `GET /v4/webhooks`, create the missing ones for `games`
  and `covers` × `create|update|delete` (other entities are optional and can be added later),
  re-create any with `active: false` (IGDB deactivates webhooks whose URL stopped answering).
- Drain: cron queue `drain-dirty`, every minute. Claims up to 500 ids with
  `delete … returning` + `for update skip locked`, does one `fetch-by-ids`, upserts through
  `writeGamesBatch`. Ids IGDB did not return get `deleted_at`. A thousand events become two IGDB
  requests, not a thousand jobs.
- Safety net: `refresh-stale-games` moves to `last_synced_at` with a limit, and `sync-catalog` runs
  daily in `incremental` mode followed by `sync-lookups`. Webhooks are at-most-once; the delta sync
  catches what they missed.

What landed (2026-10-11):

- Receiver `apps/api/src/routes/webhooks/igdb/POST.ts` + `modules/webhook/service.ts`: accepts
  `games`, `covers`, `screenshots`, `videos`, `websites`, `external_games`, `game_localizations`,
  `involved_companies` × `create|update|delete`; resolves the game through the payload's `game`
  or, for deletes that carry only an id, through our own child table; `games/delete` queues reason
  `deleted`, which wins over later reasons. Integration-tested (secret, resolution, validation).
- `drain-dirty` (`apps/librarian/src/workers/drainWorker.ts`) every minute: claims 500 rows with
  `FOR UPDATE SKIP LOCKED` inside a transaction, fetches, writes, flags `deleted_at`, and only then
  deletes the claims, so a failed IGDB call keeps them. Verified live.
- Registration (`apps/librarian/src/utils/igdb/webhooks.ts`): on start, when `WEBHOOK_BASE_URL`
  and `IGDB_WEBHOOK_SECRET` are set, lists IGDB's webhooks, creates the missing `games`/`covers`
  hooks and re-creates inactive ones. Without a public URL (dev) it logs and skips. Not yet
  exercised against IGDB with a real URL: that happens with the first homelab deploy.
- `refresh-stale-games` (`last_synced_at`) and the daily incremental sync stay as the safety net.

### Phase 6. API switch (behind `SEARCH_IGDB_FALLBACK`, code removed after a day or two)

- `apps/api/src/utils/searchGames.ts`: remove `countStrictMatches`, `claimIgdbSearch`,
  `requestIgdbSearch`, `pendingSearches`, `forceFresh`. Match on `search_names` (name + alternative
  names), add `deleted_at is null`, filter by the `game_type` column instead of the junction.
  Editions (`version_parent is not null`) are hidden from search by default, like Backloggd.
- `apps/api/src/utils/catalogRequests.ts`: keep `ensureGamesInCatalog` (add-by-id, import);
  remove `requestIgdbSearch`; remove `backfillMissingLibraryGames` once the full load ran and
  `user_games_game_id_game_id_fk` is validated.
- `GET /games/:id` grows: developers/publishers, videos, store links, editions and DLC
  (`parent_game_id` / `version_parent_id` children), collections, time to beat, alternative names,
  localized covers. Deleted games are still served (they are in libraries) with `deleted: true`;
  search and lists exclude them.
- `packages/db/src/jobs.ts`: queues left are `fetch-by-ids`, `sync-catalog`, `sync-lookups`,
  `drain-dirty`, `refresh-stale-games`. The NOTIFY channel stays for `fetch-by-ids`.
- `packages/api-client/spec.yaml`: drop `fresh`; add `deleted`, `alternativeNames`, `developers`,
  `publishers`, `videos`, `externalGames`, `collections`, `timeToBeat`, `parentGameId`,
  `versionParentId`, `localizedCovers`.

### Phase 7. Cleanup

- Migration drops `igdb_search_log`, `game_to_similar_game`, `game_to_type`, the
  `involved_companies`/`keywords` text columns, and runs `VALIDATE CONSTRAINT` on
  `user_games_game_id_game_id_fk`. Check first that no `user_games.game_id` is missing from `game`;
  create flagged stubs or clean them up.
- Write a fresh `ARCHITECTURE.md` for the new design (search flow, queues, env vars, data model) and
  update the relevant CLAUDE.md sections.
- Integration test: the fake librarian loses `search-igdb`; add tests for the webhook receiver
  (secret check, dirty row), the drain, and `writeGamesBatch` deriving columns from `raw`.

## Rollout order

1. Phases 1 + 2: one migration (the API applies it on start) and the librarian with
   `sync-lookups`. Deploy the librarian right after; it refreshes lookup names within minutes.
2. Phase 3 (driver swap) as its own deploy; no schema or behaviour change, easy to roll back.
3. Librarian with the bulk sync, full load on production (at night: user imports share the IGDB
   throttle for a few minutes). The lazy search keeps running meanwhile.
4. API with the receiver + librarian with webhook registration. Check: `catalog_dirty` fills within
   an hour on its own.
5. Local-search flag on, code removal a day later, Phase 7.

## Risks

- **IGDB throttle during the full load**: imports wait behind it for a few minutes. Run at night.
- **Duplicate ids in one batch** break `ON CONFLICT DO UPDATE`: dedupe every batch.
- **Missing lookup rows**: a game can reference a company or collection created after the last
  `sync-lookups`. Insert them from the expanded sub-object inside `writeGamesBatch`, never rely on
  the lookup sync alone.
- **FK validation**: library rows pointing at ids IGDB no longer has must be stubbed or removed
  before `VALIDATE CONSTRAINT`.
- **Long transactions**: 500 games per transaction is fine, 5000 holds locks noticeably. Don't
  enlarge the batch for speed.
- **`raw` bloat**: it is only for deriving new columns later and for debugging. If it is read in a
  hot path, materialise the field instead.
- **Webhook delivery is at-most-once** and only carries the id on delete: the daily incremental sync
  is not optional.
- **IGDB terms**: the Twitch Developer Services Agreement limits caching to 24h unless authorised
  "through these terms or otherwise"; IGDB's own FAQ explicitly prefers local storage. The current
  lazy catalog already stores data indefinitely, so the mirror changes scale, not legal status.

## Deployment: homelab Kubernetes

There is no production yet. The target is the Flux-managed homelab cluster (`~/Sites/homelab-gitops`,
see its `AGENTS.md`), following the conventions the `amela` app already uses there. This is a
separate work item from the mirror itself, but Phase 5 (webhooks) needs the public API hostname,
so the chart work should land before it.

What has to exist:

- **Helm charts in this repo**, one per service (`charts/api`, `charts/librarian`, `charts/web`),
  published as OCI to `ghcr.io/<owner>/charts/<name>` by the existing `docker-publish.yml` next to
  the images. Values must carry `image.repository` + `image.tag` so Renovate can pin
  `tag: x.y.z@sha256:…`. The librarian chart runs `replicas: 1` with `strategy: Recreate`: the IGDB
  throttle and webhook registration are per process.
- **In `homelab-gitops`**: `apps/playdamnit/` with namespace, `OCIRepository` + `HelmRelease` per
  service, a `ghcr` pull secret, and a `clusters/homelab/playdamnit.yaml` Flux Kustomization.
- **Postgres via CloudNativePG**: a single-instance `Cluster` (`postgresql:18`, `local-path`,
  prune disabled) with `barmanObjectStore` to the RustFS S3 and a daily `ScheduledBackup`, same as
  `amela-postgres`. Size the volume for the mirror (measured ~9 GB → 30Gi). `pg_trgm` is a
  trusted extension, so the migration's `CREATE EXTENSION` works for the non-superuser owner.
  The backup covers the whole database; only the user tables are irreplaceable, the catalog is
  rebuilt by `sync-catalog`.
- **Secrets**: one `ExternalSecret` per service from the `Homelab` 1Password vault, templating
  `POSTGRES_URL` from the CNPG owner secret (`…-rw.playdamnit.svc.cluster.local`), plus
  `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `TWITCH_CLIENT_ID/SECRET`, `IGDB_WEBHOOK_SECRET`,
  `WEBHOOK_BASE_URL`, `OPENAI_API_KEY`, `SENTRY_DSN`, `TRUSTED_ORIGINS`, `TRUST_PROXY=true`
  (requests arrive through the tunnel).
- **Public hostnames** in `charts/cloudflared/values.yaml`: one for the web app and one for the
  API; the API hostname is what IGDB webhooks are registered against.
- **Network policies** (deny by default): api and librarian → CNPG `rw` service; librarian egress to
  `api.igdb.com` and `id.twitch.tv`; api egress to Resend, OpenAI and Sentry; cloudflared → api and
  web ingress; DNS and Kubernetes API as in the baseline.
- **Migrations**: the API image already applies them on start (`entrypoint.sh`). Keep that, but with
  one API replica only; if the API ever scales out, move migrations to a Helm pre-upgrade hook Job.
- **Health**: the chart's readiness probe hits `/health` (it checks the database). The librarian has
  no HTTP endpoint; give it a liveness probe later (Phase 7 is a good moment to add `/health` to it)
  and an Uptime Kuma check on the API.

## References

- IGDB API docs (FAQ, Rate Limits, Webhooks, endpoints): https://api-docs.igdb.com/
- Twitch Developer Services Agreement, Schedule 1: https://legal.twitch.com/legal/developer-agreement/
- Reference products: https://backloggd.com (Rails, full mirror, editions folded into parents,
  time to beat, series) and https://mygamelist.club (Next.js + Go + MongoDB, one document per game,
  alternative names in search, store links, videos).
