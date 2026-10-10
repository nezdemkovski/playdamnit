# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This project uses **Bun** as the runtime and package manager. Never use npm, node, pnpm, or yarn.

### Running the Application

```bash
# Development with hot reload
bun run dev

# Production
bun run start
```

### Database Management

All data lives in a single **PostgreSQL** database. Drizzle ORM manages migrations.

```bash
# Generate schema from Better Auth
bun run db:pg:generate:authschema

# Generate migrations
bun run db:pg:generate

# Apply migrations (drizzle-kit, dev) / runtime migrator (used by the Docker entrypoint)
bun run db:pg:migrate
bun run db:pg:migrate:runtime

# Open Drizzle Studio
bun run db:pg:studio
```

### API Client Generation

The project auto-generates a TypeScript client from the OpenAPI spec:

```bash
# Generate API client (React Query hooks)
bun run orval:generate
```

This generates the `api-client` package from `spec.yaml`. The GitHub workflow automatically publishes updates to npm.

### Docker

```bash
# Build and run with Docker Compose
bun run docker:compose:build

# Run development environment
bun run docker:compose:dev

# Stop containers
bun run docker:compose:down

# Database backup/restore
bun run docker:db:backup
bun run docker:db:restore
```

### After Creating Files

Run this script to update project documentation:
```bash
./.scripts/update_structure.sh
```

## Architecture Overview

### Framework & Runtime

- **Elysia** web framework with Bun runtime
- Entry point: `src/index.ts`
- Port: 3030 (configurable via `PORT` env var)
- OpenAPI docs at `/openapi`

### Database

Single **PostgreSQL** database for everything — game catalog, user accounts, sessions, and the job queue.

- **Drizzle ORM 1.0 (RC)** (`db/postgres/index.ts`) for all queries
  - Tables: `db/postgres/schema.ts`; relations: `db/postgres/relations.ts` (`defineRelations`, RQB v2). The client is built with `drizzle(url, { relations })`.
  - Relational queries use the v2 object syntax: `where: { id: 1 }`, `where: { platforms: { id } }`, `where: { RAW: (t) => sql\`...\` }`, `orderBy: { addedAt: "desc" }` or `orderBy: (t) => [...]`. Inside `RAW`/`orderBy` callbacks use the table passed in, not the imported table (RQB aliases it).
  - Many-to-many relations go `through` the junction tables, so `with: { platforms: true }` returns platform rows directly.
  - Migrations live in `db/postgres/migrations/<timestamp>_<name>/{migration.sql,snapshot.json}` (drizzle-kit v1 format, no journal). For renames `drizzle-kit generate` asks for `--hints` instead of prompting.
- **pg-boss** runs inside the same PostgreSQL instance (manages its own `pgboss` schema)
- Never touch the `pgboss` schema manually

### Services

**Backend** (`backend/`) — Elysia HTTP API:
- Queries game catalog from PostgreSQL
- Enqueues pg-boss jobs when games are missing (`search-igdb`, `fetch-by-ids`)
- Holds open HTTP requests via `LISTEN game_catalog_updated` (NOTIFY from librarian), max 10s (30s for imports)
- **Never calls IGDB directly**

**Librarian** (`librarian/`) — headless background worker:
- Registers `search-igdb`, `fetch-by-ids`, `process-similar-games`, `refresh-stale-games` pg-boss workers
- Sole owner of all IGDB logic
- Writes game data to PostgreSQL, then sends `NOTIFY game_catalog_updated`
- Run locally: `bun run dev` in `librarian/`

### Job Queue (pg-boss)

pg-boss is a PostgreSQL-backed job queue — no separate queue service needed.

Queue names, payloads and the NOTIFY channel are defined once in `db/postgres/jobs.ts` (the librarian re-exports it). Both services call `createQueue()` for every queue on startup — pg-boss >= 10 refuses to send to or work on a queue that doesn't exist. Work handlers receive an **array** of jobs.

| Job name | Producer | Consumer | Notes |
|---|---|---|---|
| `search-igdb` | Backend | Librarian | Search IGDB by query string |
| `fetch-by-ids` | Backend / Librarian | Librarian | Fetch specific IGDB game IDs (batches of 500); `depth` tracks similar-games hops |
| `process-similar-games` | Librarian | Librarian | Link similar games; fetch missing ones while `depth < SIMILAR_GAMES_MAX_DEPTH` (default 1) |
| `refresh-stale-games` | pg-boss cron (04:00) | Librarian | Re-fetch games not updated for 30 days |

Workers are registered in `librarian/src/workers/`. Backend enqueues through `src/utils/catalogRequests.ts`, which registers the NOTIFY wait *before* sending. The librarian NOTIFYs `{ requestId, ok }` on success and on failure (then rethrows so pg-boss retries); IGDB errors are never swallowed.

**Deduplication:** concurrent identical searches share one promise in-process; across instances, `igdb_search_log` is claimed atomically so one query hits IGDB at most once per 7 days (1 minute with `fresh=1`).

### Search Flow

1. Backend queries PostgreSQL with escaped ILIKE + the pg_trgm `%` operator (uses the GIN index)
2. On the first page, if fewer than 3 substring matches exist and the query wasn't searched in IGDB within 7 days:
   - enqueue `search-igdb`, wait for NOTIFY (max 10s), then query PG (source: `igdb`)
3. Otherwise return local results (source: `database`)

List endpoints return a light "card" projection (`GAME_CARD_WITH`); screenshots, websites and similar games are only loaded by `GET /api/games/:id`.

### File-Based Routing

Routes in `src/routes/` use a file-based structure where each HTTP method is a separate file:

```
routes/
├── index.ts                    # Aggregates all routes
├── games/
│   ├── GET.ts                 # List games
│   ├── [id]/GET.ts            # Game details
│   └── search/GET.ts          # Search games
└── user/[username]/
    └── games/
        ├── GET.ts             # User's game library
        ├── POST.ts            # Add game to library
        ├── import.ts          # Bulk import (CSV/JSON)
        └── [id]/
            ├── PATCH.ts       # Update status/rating
            └── DELETE.ts      # Remove from library
```

Each route file exports an Elysia instance. They're composed in `index.ts` using `.use()`. Use Elysia's `macro({ auth: true })` for protected routes.

Use `t.Union([t.Literal(...)])` for enums, not `t.UnionEnum`: inside `t.Optional`, Elysia 1.4.30 fills a missing `UnionEnum` with its first value.

Routes stay thin: business logic lives in `src/modules/*/service.ts`, request schemas shared between routes in `src/modules/*/model.ts`. Services **throw** `AppError` subclasses (`src/utils/errors.ts`); the global `onError` in `src/index.ts` maps them to `{ error, message }` with the right status. Rate limits (`src/utils/rateLimit.ts`, in-memory per instance) guard search, import and AI chat.

### IGDB API Integration

**Location:** `librarian/src/utils/igdb/`

**Token Management:**
- OAuth tokens cached in-process in librarian (expires 5 min early)
- Each librarian instance manages its own token independently
- Requires `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` (librarian env only)

**Key Functions:**
- `searchIGDB()`: Full-text search with filters
- `fetchIGDBByIds()`: Batch fetch by IDs
- Transformers convert IGDB responses to internal schema

**Rate Limiting:**
`igdbRequest()` spaces requests ≥260ms apart (IGDB allows 4/s). Search strings are escaped for Apicalypse (`escapeApicalypseString`).

### Authentication (Better Auth)

**Location:** `src/lib/auth.ts`

**Features:**
- Email/password with email verification
- Passkey (WebAuthn) support
- API key authentication
- Admin plugin for user management

**Database:**
- Uses PostgreSQL with the Drizzle adapter. The auth tables are passed to `drizzleAdapter(db, { schema })` explicitly — with Drizzle v1 the client no longer carries a schema and Better Auth reports "Drizzle schema mismatch" without it.
- The API key plugin is `@better-auth/api-key` (keys belong to `referenceId`, grouped by `configId`).
- The Better Auth CLI can't load `src/lib/auth.ts` (it runs under Node; the db driver is `bun-sql`), so keep the auth tables in `schema.ts` in sync with Better Auth by hand when upgrading it.

**Route Protection:**
Use Elysia's macro system:
```typescript
app.get('/protected', () => { ... }, { auth: true })
```

The macro injects `user` and `session` into the route context.

### Logging & Error Tracking

**Logger** (`src/utils/enhancedLogger.ts`):
- Winston with daily rotating files (14-day retention)
- Levels: ERROR, WARN, INFO, DEBUG, TRACE, SYSTEM
- Files: `error-*.log`, `combined-*.log`, `info-*.log`

**Sentry Integration:**
- Automatic error capture (uncaught exceptions, unhandled rejections)
- 20% sample rate in production, 100% in dev
- Requires `SENTRY_DSN` environment variable

## Key Design Patterns

### Adding a New Route

1. Create route file: `src/routes/[resource]/[method].ts`
2. Export Elysia instance with handler
3. Add to `src/routes/index.ts` aggregator
4. Update `spec.yaml` for API client generation

### Adding a New Database Table

1. Define schema in `db/postgres/schema.ts`
2. Generate migration: `bun run db:pg:generate`
3. Apply migration: `bun run db:pg:migrate`
4. If the table is part of the game catalog, also update `librarian/db/postgres/schema.ts` manually (see Schema Sync below)

### IGDB Data Import Flow

```
User Request → searchGamesWithCache()
  ├─ Query local PostgreSQL (ILIKE + similarity)
  └─ If no results: boss.send('search-igdb', ...)
       ↓
  waitForNotify(requestId) — max 10s
       ↓
Librarian igdbWorker (pg-boss)
  ├─ searchIGDB()
  ├─ Transform IGDB response
  ├─ writeGamesBatch() → INSERT into PG
  ├─ NOTIFY game_catalog_updated
  └─ boss.send('process-similar-games', ...)
       ↓
Librarian similarGamesWorker (pg-boss)
  ├─ Check which similar IDs already exist
  ├─ boss.send('fetch-by-ids', { missingIds })
  └─ Insert bidirectional rows in game_to_similar_game
       ↓
Similar Games cascade grows catalog over time
```

### User Game Import (CSV/JSON)

`UserGameService.importUserGames` validates rows, fetches missing games with one `fetch-by-ids` job (`ensureGamesInCatalog`), then writes everything in one transaction with `ON CONFLICT` on `(user_id, game_id)`. CSV parsing/export lives in `src/modules/userGame/csv.ts` (RFC 4180, formula-escaped export).

## Shared Schema

`backend/db/postgres/schema.ts` (plus `relations.ts`) is the only schema. `librarian/db/postgres/{schema,relations,jobs}.ts` just re-export the backend files, so the librarian's Docker build context is the repo root. Migrations are only run from the backend (the Docker entrypoint runs them on start).

## Environment Variables

Required:
```bash
# Database (used by both backend and librarian)
POSTGRES_URL=postgresql://user:pass@host:5432/db

# Authentication (backend only, required in production)
BETTER_AUTH_SECRET=random-secret-min-32-chars

# Email Service (backend only, required in production: sign-up needs email verification)
RESEND_API_KEY=re_xxxx

# IGDB API (librarian only)
TWITCH_CLIENT_ID=your-client-id
TWITCH_CLIENT_SECRET=your-client-secret
```

Optional:
```bash
OPENAI_API_KEY=sk-xxx           # For AI chat feature (503 when unset)
OPENAI_MODEL=gpt-4o             # Model for AI chat
TRUST_PROXY=false               # Use X-Forwarded-For for rate limiting
SIMILAR_GAMES_MAX_DEPTH=1       # Librarian: similar-games crawl depth
SENTRY_DSN=https://xxx          # Error tracking
TRUSTED_ORIGINS=https://app.playdamnit.com,https://playdamnit.com
PORT=3030                       # Default port
NODE_ENV=development            # development or production
LOG_LEVEL=info                  # Logging verbosity

# Docker only
RUN_MIGRATIONS=true             # Auto-run migrations
```

## Common Development Scenarios

### Adding a New Game Field

1. Update schema: `db/postgres/schema.ts`
2. Generate migration: `bun run db:pg:generate`
3. Apply migration: `bun run db:pg:migrate`
4. Update IGDB transformer: `librarian/src/utils/igdb/transformers.ts`
5. Update game type in `spec.yaml` for API client
6. Regenerate API client: `bun run orval:generate`

### Testing IGDB Integration

The IGDB API has rate limits. Use the local database first:
```typescript
// Always check local first
const localGames = await db.select()...;
if (localGames.length === 0) {
  // Then delegate to librarian via pg-boss
}
```

## Performance Considerations

1. **Database Queries:** Use Drizzle's `with` for eager loading; lists use `GAME_CARD_WITH`, never the full graph
2. **IGDB Batching:** `fetchIGDBByIds` sends up to 500 ids per request with an explicit `limit` (IGDB's default is 10)
3. **Search:** GIN trigram index on `game.name`; use the `%` operator rather than `similarity() >` in WHERE so the index applies
4. **Deduplication:** In-process `Map` per instance plus the `igdb_search_log` claim across instances

## Testing

```bash
bun test                                                     # unit tests
TEST_POSTGRES_URL=postgres://.../playdamnit_test bun test    # + integration tests (disposable DB, gets truncated)
```

`tests/setup.ts` overrides `POSTGRES_URL` so tests never touch the database from `.env`.

## CI/CD

GitHub Actions:
- `.github/workflows/docker-publish.yml`: Builds and publishes Docker image to GHCR
- `.github/workflows/orval-client-generator.yml`: Auto-generates and publishes API client to npm

Both trigger on push to `master` and version tags.
