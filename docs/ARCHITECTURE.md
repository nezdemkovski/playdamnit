# Architecture

## Stack

| Layer          | Technology                                                 |
| -------------- | ---------------------------------------------------------- |
| Runtime        | Bun                                                        |
| Web framework  | Elysia 2.0 beta                                            |
| Database       | PostgreSQL 18 (single DB for everything)                   |
| ORM            | Drizzle ORM 1.0 RC (pg-core, relational queries v2)        |
| Driver         | node-postgres in both services (one `pg.Pool` per process) |
| Job queue      | pg-boss 12 (runs inside PostgreSQL)                        |
| Auth           | Better Auth (email, passkey, API key)                      |
| IGDB access    | Librarian service only                                     |
| Catalog        | Full mirror of IGDB games, kept fresh by IGDB webhooks     |
| Search         | pg_trgm GIN index on `game.search_names`                   |
| Email          | Resend                                                     |
| Error tracking | Sentry                                                     |
| Logging        | Winston + daily-rotate-file                                |

---

## Services

### API (`apps/api/`)

Elysia HTTP API. Handles all user-facing requests.

- Serves the catalog, search and user libraries from PostgreSQL. **Never calls IGDB.**
- When a library write references a game the catalog lacks (import, add by id), it enqueues a
  `fetch-by-ids` job and waits for `NOTIFY game_catalog_updated` (10s; 30s for imports).
- Receives IGDB webhooks at `POST /api/webhooks/igdb/:entity/:method` and only records the game
  id in `catalog_dirty`.

### Librarian (`apps/librarian/`)

Headless worker and the only IGDB client. Runs as a **single instance**: the IGDB throttle
(4 requests/s) lives in the process.

- `sync-catalog`: walks IGDB's `/games` into the catalog, by id (full) or by `updated_at`
  (incremental, daily at 02:00). 20 pages of 100 games per job, re-enqueuing itself with the
  cursor (`sync_state`), so a walk survives restarts.
- `drain-dirty` (every minute): re-fetches the games IGDB webhooks marked, flags the ones IGDB no
  longer returns with `deleted_at`.
- `sync-lookups` (daily 03:30, after start): mirrors platforms, genres, game modes, themes, game
  types, website types, external game sources, collections, companies and time-to-beat.
- `refresh-stale-games` (daily 04:00): re-fetches games not synced for 30 days (safety net).
- `fetch-by-ids`: on-demand fetch for the API, answered with `NOTIFY`.
- On start it registers the `games` and `covers` webhooks with IGDB when `WEBHOOK_BASE_URL` and
  `IGDB_WEBHOOK_SECRET` are set.

Every game write goes through `src/catalog/writeGames.ts`: one transaction per batch, bulk upserts
per table, the expanded IGDB document kept in `game.raw`, columns and child rows derived from it by
`src/catalog/derive.ts`.

---

## Data flow

```
Browser / Frontend
        │
        ▼
   API (Elysia)  ──── reads catalog, writes libraries ────►  PostgreSQL
        │  fetch-by-ids (pg-boss) / NOTIFY                       ▲
        │  catalog_dirty (webhooks)                               │  bulk upserts
        ▼                                                         │
   Librarian  ◄──── sync-catalog / drain-dirty / sync-lookups ────┘
        │
        └──► IGDB API (Twitch auth)  ──── webhooks ────►  API
```

### Search

`GET /api/games/search?q=` runs entirely on PostgreSQL: `search_names` (name + alternative
names) is matched by escaped `ILIKE` or pg_trgm word similarity (`<%`), both on the GIN index, and
ranked by `similarity(name, q)`, popularity and rating count. Deleted games and editions
(`version_parent_id`) are hidden unless `editions=1`; `types=` filters by IGDB game_type id.

### Freshness

1. IGDB posts a webhook; the API stores the game id in `catalog_dirty`.
2. `drain-dirty` claims rows with `FOR UPDATE SKIP LOCKED`, fetches the games in one request,
   writes them, flags missing ones as deleted, and removes the claims only on success.
3. The daily incremental `sync-catalog` catches anything a webhook missed; `refresh-stale-games`
   catches anything older than 30 days.

### Library writes

`POST /api/user/:username/games` and the import check which game ids the catalog lacks, enqueue
one `fetch-by-ids` job, wait for the librarian's `NOTIFY { requestId, ok }`, then write the
library rows in one transaction (`ON CONFLICT (user_id, game_id)`).

---

## Database

All tables live in `public`; `pgboss` is managed by pg-boss and never touched by hand.

### Catalog (mirror of IGDB; every primary key is the IGDB id)

| Table                                                                                                                           | Notes                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `game`                                                                                                                          | Derived columns + `raw jsonb` (the expanded document), `search_names` (trigram-indexed), `similar_game_ids int[]`, `deleted_at`, sync timestamps |
| `platform`, `genre`, `game_mode`, `theme`, `type`, `website_type`, `company`, `collection`, `external_game_source`              | Lookups, upserted by id                                                                                                                          |
| `cover`, `screenshot`, `website`, `video`, `external_game`, `game_localization`                                                 | Game-owned rows, replaced on every game write                                                                                                    |
| `game_time_to_beat`                                                                                                             | One row per game, from IGDB's own endpoint                                                                                                       |
| `game_to_platform`, `game_to_genre`, `game_to_game_mode`, `game_to_theme`, `game_to_collection`, `game_to_company` (with roles) | Junctions                                                                                                                                        |
| `sync_state`                                                                                                                    | Cursors and last-run timestamps of the syncs                                                                                                     |
| `catalog_dirty`                                                                                                                 | Game ids queued by webhooks                                                                                                                      |

Deleted games keep their row (libraries reference them) and carry `deleted_at`; the API serves
them with `deleted: true` and hides them from search and catalog lists.

### Users (Better Auth + custom)

`user`, `session`, `account`, `verification`, `passkey`, `apikey`, `user_metadata`, `user_games`
(unique `(user_id, game_id)`, FK to `game` and `platform`), `user_follows`. These are the only
tables that need backups; the catalog is rebuilt from IGDB.

Schema: `packages/db/src/schema.ts`; relations: `src/relations.ts`; queue contract: `src/jobs.ts`;
migrations: `packages/db/migrations/` (applied by the API image on start).

---

## Queues (pg-boss)

| Queue                 | Producer           | Consumer  | Payload               |
| --------------------- | ------------------ | --------- | --------------------- |
| `fetch-by-ids`        | API, librarian     | Librarian | `{ ids, requestId? }` |
| `sync-catalog`        | Hand / cron / self | Librarian | `{ mode, cursor? }`   |
| `sync-lookups`        | Cron / start       | Librarian | `{ force? }`          |
| `drain-dirty`         | Cron               | Librarian | —                     |
| `refresh-stale-games` | Cron               | Librarian | —                     |

All queues are created by both services on start. `apps/librarian/scripts/enqueue.ts` puts a job
on any of them from the command line (`bun run scripts/enqueue.ts sync-catalog full`).

---

## Environment

### API

| Variable              | Required | Notes                                         |
| --------------------- | -------- | --------------------------------------------- |
| `POSTGRES_URL`        | Yes      |                                               |
| `BETTER_AUTH_SECRET`  | Prod     | Min 32 chars                                  |
| `RESEND_API_KEY`      | No       | Enables email verification and password reset |
| `IGDB_WEBHOOK_SECRET` | No       | Enables the webhook receiver                  |
| `OPENAI_API_KEY`      | No       | AI chat                                       |
| `SENTRY_DSN`          | No       |                                               |
| `TRUSTED_ORIGINS`     | No       | Comma-separated CORS origins                  |
| `TRUST_PROXY`         | No       | Honour `X-Forwarded-For` (behind a proxy)     |
| `PORT`, `LOG_LEVEL`   | No       |                                               |

### Librarian

| Variable                                   | Required | Notes                                   |
| ------------------------------------------ | -------- | --------------------------------------- |
| `POSTGRES_URL`                             | Yes      | Same database                           |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Yes      | IGDB auth                               |
| `WEBHOOK_BASE_URL`, `IGDB_WEBHOOK_SECRET`  | No       | Public API URL; registers IGDB webhooks |
| `LOG_LEVEL`                                | No       |                                         |

---

## Operations

- **First full walk**: `bun run scripts/enqueue.ts sync-catalog full` in the librarian. ~350k
  games at ~32 games/s ≈ 3 hours; the database grows to ~9 GB. Drop `idx_game_name_trgm` and
  `idx_game_search_names_trgm` before, recreate them and `VACUUM ANALYZE` after.
- **Deployment**: see `CATALOG_MIRROR_PLAN.md` (homelab Kubernetes section).
