# Architecture

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Web framework | Elysia 2.0 beta |
| Database | PostgreSQL 17 (single DB for everything) |
| ORM | Drizzle ORM 1.0 RC (pg-core, relational queries v2) |
| Job queue | pg-boss 12 (runs inside PostgreSQL) |
| Auth | Better Auth (email, passkey, API key) |
| IGDB access | Librarian service only |
| Email | Resend |
| Error tracking | Sentry |
| Logging | Winston + daily-rotate-file |
| Search index | pg_trgm (GIN index on `game.name`) |

---

## Services

### API (`apps/api/`)
Elysia HTTP API. Handles all user-facing requests.
- Queries game catalog from PostgreSQL
- Enqueues pg-boss jobs when games are missing (`search-igdb`, `fetch-by-ids`)
- Holds open HTTP requests via `LISTEN game_catalog_updated` (NOTIFY from librarian), max 10s
- **Never calls IGDB directly**

### Librarian (`apps/librarian/`)
Headless background worker. Sole owner of all IGDB logic.
- Registers `search-igdb`, `fetch-by-ids`, `process-similar-games` pg-boss workers
- Writes game data to PostgreSQL, then sends `NOTIFY game_catalog_updated`
- Cascades similar-games chain by enqueueing further `fetch-by-ids` jobs

---

## Architecture Diagram

```
Browser / Frontend
        │
        ▼
Backend (Elysia :3030)
        │  ILIKE queries, pg-boss send()
        │
        ▼
   PostgreSQL
        ▲
        │  INSERT game data, NOTIFY
        │
   Librarian (pg-boss work())
        │
        └──► IGDB API (Twitch auth)
```

The backend LISTEN client is a **dedicated `pg.Client`** (not pooled) connected to
`game_catalog_updated`. When the librarian finishes writing games it sends
`NOTIFY game_catalog_updated, '{"requestId":"..."}''`, which immediately resolves
the waiting HTTP request. If the librarian is down the timeout fires at 10s and
the backend returns empty results.

---

## Database Schema

All tables live in the default `public` schema of a single PostgreSQL database.
The `pgboss` schema is managed automatically by pg-boss — never touch it manually.

### User tables (managed by Better Auth + custom)
| Table | Purpose |
|---|---|
| `user` | Accounts |
| `session` | Auth sessions |
| `account` | OAuth provider links |
| `verification` | Email verification tokens |
| `passkey` | WebAuthn credentials |
| `apikey` | API key auth |
| `user_metadata` | Bio etc. |
| `user_games` | User's game library entries; unique `(user_id, game_id)`, FK to `game` and `platform` |
| `user_follows` | Social follows; unique pair, no self-follow |
| `igdb_search_log` | Queries already sent to IGDB (cooldown, cross-instance dedup) |

### Game catalog tables (populated organically from IGDB)
| Table | Key notes |
|---|---|
| `game` | PK = IGDB ID (plain integer, **not** auto-generated); `name` indexed with GIN trigram (`idx_game_name_trgm`) |
| `platform` | PK = auto-generated identity; unique on `slug` |
| `genre` | PK = auto-generated identity; unique on `slug` |
| `game_mode` | PK = auto-generated identity; unique on `slug` |
| `type` | PK = auto-generated identity; unique on `type` |
| `website_type` | PK = auto-generated identity; unique on `type` |
| `cover` | One-to-one with `game`; cascade delete |
| `screenshot` | Many-to-one with `game`; cascade delete |
| `website` | Many-to-one with `game`; cascade delete |
| `game_to_platform` | Junction; composite PK |
| `game_to_genre` | Junction; composite PK |
| `game_to_game_mode` | Junction; composite PK |
| `game_to_type` | Junction; composite PK |
| `game_to_similar_game` | Self-referential junction; bidirectional rows |

**Critical:** `game.id` is `integer("id").primaryKey()` — no `generatedAlwaysAsIdentity`.
IGDB IDs are inserted explicitly from the IGDB API response.

Drizzle schema files:
- `packages/db/src/schema.ts` — the only schema (source of truth for migrations)
- `packages/db/src/relations.ts` — `defineRelations` (RQB v2); many-to-many relations go `through` junction tables
- `packages/db/src/jobs.ts` — queue names, job payloads, NOTIFY channel
- `packages/db/migrations/` — drizzle-kit v1 migrations; `packages/db/src/migrate.ts` applies them
- `apps/api/db/postgres/index.ts`, `apps/librarian/db/postgres/index.ts` — each app's Drizzle client

Run migrations with: `bun run db:pg:generate && bun run db:pg:migrate`

---

## Key Flows

### Search flow
1. `GET /api/games/search?q=zelda` (rate limited per client)
2. Backend: escaped `ILIKE %zelda%` OR `name % 'zelda'` (pg_trgm operator, uses the GIN index), ordered by similarity, `is_popular`, `total_rating`
3. On the first page, ask IGDB when there are fewer than 3 substring matches **and** the query can be claimed in `igdb_search_log` (not searched within 7 days; 1 minute with `fresh=1`):
   - register `waitForNotify(requestId)`, then `boss.send('search-igdb', …)`
   - resolves on NOTIFY `{ requestId, ok }` or after 10s, then PG is queried (source: `igdb`)
4. Otherwise return local results (source: `database`)
5. In-process `Map<string, Promise>` shares concurrent identical searches; lists return a light card projection

### Import flow
1. `POST /api/user/:username/games/import` with CSV or JSON body (≤1000 rows, rate limited)
2. Validate rows; one query finds game IDs missing from PG
3. One `fetch-by-ids` job for all missing IDs; wait for NOTIFY (max 30s)
4. One query confirms which IDs landed; one transaction inserts with `ON CONFLICT (user_id, game_id)` (skip or overwrite)

### Similar games cascade
1. When the librarian writes a game with `similar_games`:
   - `boss.send('process-similar-games', { gameId, similarGameIds, depth })`
2. `process-similar-games` worker:
   - Inserts bidirectional rows in `game_to_similar_game` for similar games already in PG
   - Fetches missing ones only while `depth + 1 <= SIMILAR_GAMES_MAX_DEPTH` (default 1)
3. Missing games get linked when they arrive (their own job links back). Depth keeps the crawl bounded; IGDB calls are throttled to <4/s.

### Catalog refresh
`refresh-stale-games` runs daily (pg-boss cron) and re-fetches up to 1000 games not updated for 30 days. Writes are upserts, so ratings, covers, popularity and relations stay current.

---

## pg-boss Job Types

| Job name | Producer | Consumer | Payload |
|---|---|---|---|
| `search-igdb` | Backend | Librarian | `{ query, limit, requestId }` |
| `fetch-by-ids` | Backend / Librarian | Librarian | `{ ids, requestId?, depth? }` |
| `process-similar-games` | Librarian | Librarian | `{ gameId, similarGameIds, depth }` |
| `refresh-stale-games` | pg-boss cron | Librarian | — |

All queues are created with `createQueue()` by both services on startup (required since pg-boss 10).

`process-similar-games` runs with `teamSize: 5` (5 concurrent workers).

Retry configuration varies by job and call site:

| Job name | Retry config |
|---|---|
| `search-igdb` | None set — uses pg-boss defaults |
| `fetch-by-ids` (backend-initiated) | None set — uses pg-boss defaults |
| `fetch-by-ids` (librarian cascade) | `retryLimit: 3, retryDelay: 30` |
| `process-similar-games` | `retryLimit: 3, retryDelay: 30` |

---

## Enums

Both `GameTypeEnum` and `ImageSourceEnum` live in `packages/db/src/schema.ts`
and are re-exported from each app's `db/postgres/index.ts`.

`apps/api/src/utils/image.ts` imports `ImageSourceEnum` from `@playdamnit/db/schema`.

---

## Utilities

| File | Purpose |
|---|---|
| `apps/api/src/utils/pgBoss.ts` | Lazy singleton: `getBoss()` / `stopBoss()` |
| `apps/api/src/utils/pgNotify.ts` | `initNotifyListener()`, `waitForNotify(requestId)`, `closeNotifyListener()` |
| `apps/api/src/utils/searchGames.ts` | `searchGamesWithCache()` — PG ILIKE + pg-boss + NOTIFY |
| `apps/api/src/utils/gameTransformers.ts` | `transformGameResponse()` — flatten Drizzle result to API shape |
| `apps/api/src/utils/image.ts` | `getImageUrl()` — IGDB CDN URL builder |
| `apps/librarian/src/workers/igdbWorker.ts` | `search-igdb` + `fetch-by-ids` handlers, `writeGamesBatch()`, NOTIFY sender |
| `apps/librarian/src/workers/similarGamesWorker.ts` | `process-similar-games` handler |
| `apps/librarian/src/utils/igdb/token.ts` | In-process IGDB token cache (expires 5min early) |
| `apps/librarian/src/utils/igdb/utils.ts` | `searchIGDB()`, `fetchIGDBByIds()` |
| `apps/librarian/src/utils/igdb/transformers.ts` | `transformIGDBResponse()` — IGDB → internal shape |

---

## Environment Variables

### Backend
| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_URL` | Yes | Full connection URL |
| `BETTER_AUTH_SECRET` | Yes | Min 32 chars |
| `JWT_SECRET` | Yes | |
| `RESEND_API_KEY` | Yes | Email service |
| `OPENAI_API_KEY` | No | AI chat feature |
| `SENTRY_DSN` | No | Error tracking |
| `TRUSTED_ORIGINS` | No | Comma-separated CORS origins |
| `PORT` | No | Default 3030 |
| `LOG_LEVEL` | No | Default `error` |

### Librarian
| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_URL` | Yes | Same DB as backend |
| `TWITCH_CLIENT_ID` | Yes | IGDB auth |
| `TWITCH_CLIENT_SECRET` | Yes | IGDB auth |
| `LOG_LEVEL` | No | Default `error` |

---

## Drizzle Config

`packages/db/drizzle.config.ts` reads `POSTGRES_URL` (the `db:migrate`/`db:studio` scripts load it
from `apps/api/.env`). `generate` and `check` only diff the schema against the migrations folder.

---

## Docker Compose

`docker-compose.yml` (repo root) — production-like stack:
- Services: `postgres`, `api` (runs migrations on start, healthcheck on `/health`), `librarian`
  (starts once `api` is healthy), `web`
- Images build from the repo root with `turbo prune`; config comes from the root `.env`

`docker-compose.dev.yml` — just Postgres for local development; apps run on the host with
`bun run dev` (turbo).
