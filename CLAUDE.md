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

The project uses **dual databases**: SQLite for game data, PostgreSQL for user data.

**PostgreSQL (User Database):**
```bash
# Generate schema from Better Auth
bun run db:pg:generate:authschema

# Generate migrations
bun run db:pg:generate

# Apply migrations
bun run db:pg:migrate

# Open Drizzle Studio
bun run db:pg:studio
```

**SQLite (Game Database):**
```bash
# Generate migrations
bun run db:sqlite:generate

# Apply migrations
bun run db:sqlite:migrate

# Seed the database
bun run db:sqlite:seed

# Open Drizzle Studio
bun run db:sqlite:studio
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
- Swagger docs at `/swagger`

### Dual Database System

**Why Two Databases:**
- **SQLite** (`games.db`): Game catalog data - read-heavy, high performance with WAL mode
- **PostgreSQL**: User accounts, sessions, game libraries - relational integrity for user data

**SQLite Optimizations:**
The game database uses aggressive performance tuning:
- WAL mode for concurrent reads during writes
- 512MB memory-mapped I/O
- 20MB page cache
- Temp tables in memory

**Database Clients:**
- Both use Drizzle ORM
- SQLite: `db/sqlite/index.ts`
- PostgreSQL: `db/postgres/index.ts`

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

### Redis Queue System (Critical)

**Purpose:** Decouple expensive operations from API responses.

**Two Main Queues:**

1. **SQLite Write Queue** (`sqlite_write`)
   - Worker: `src/utils/redis/sqliteWriter.ts`
   - Job types: `INSERT_GAME`, `INSERT_GAMES_BATCH`, `UPDATE_GAME`
   - Handles transactional writes with relationships (platforms, genres, modes)
   - Automatically started as background worker in `src/index.ts`

2. **Similar Games Queue** (`similar_games`)
   - Worker: `src/utils/redis/similarGamesQueue.ts`
   - Asynchronously builds game similarity relationships
   - Fetches missing games from IGDB in batches
   - Only processes when system load is low (main queue < threshold)
   - See `SIMILAR_GAMES_SYSTEM.md` for detailed flow

**Queue Infrastructure:**
- Base class: `src/utils/redis/redisQueue.ts`
- Job statuses: `pending`, `processing`, `completed`, `failed`
- Auto-retry up to 3 attempts
- Workers poll every 1 second

**Important:** When adding games to the database, always enqueue them through the write queue - never write directly from route handlers.

### IGDB API Integration

**Location:** `src/utils/igdb/`

**Token Management:**
- OAuth tokens cached in Redis (24-hour TTL)
- Auto-refresh before expiration
- Requires `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`

**Key Functions:**
- `searchIGDB()`: Full-text search with filters
- `fetchIGDBByIds()`: Batch fetch by IDs
- Transformers convert IGDB responses to internal schema

**Rate Limiting:**
Always batch requests when fetching multiple games. The similar games worker demonstrates best practices.

### Authentication (Better Auth)

**Location:** `src/lib/auth.ts`

**Features:**
- Email/password with email verification
- Passkey (WebAuthn) support
- API key authentication
- Admin plugin for user management

**Database:**
- Uses PostgreSQL with Drizzle adapter
- Auto-generates schema: `bun run db:pg:generate:authschema`

**Route Protection:**
Use Elysia's macro system:
```typescript
app.get('/protected', () => { ... }, { auth: true })
```

The macro injects `user` and `session` into the route context.

### Search & Caching Strategy

**Search Flow** (`src/utils/searchGames.ts`):
1. Check Redis cache (24-hour TTL)
2. Query local SQLite database
3. If not found, search IGDB API
4. Enqueue games for batch insert
5. Return cached results immediately

**Cache Keys:**
- Search results: `search:games:{query}:{limit}:{offset}`
- IGDB tokens: `igdb:access_token`
- Similar game relationships: `similar_games:relationships`

**Lock Mechanism:**
Concurrent identical searches are deduplicated using Redis locks to prevent redundant IGDB API calls.

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

**SQLite:**
1. Define schema in `db/sqlite/schema/index.ts`
2. Generate migration: `bun run db:sqlite:generate`
3. Apply migration: `bun run db:sqlite:migrate`

**PostgreSQL:**
1. Define schema in `db/postgres/schema.ts`
2. Generate migration: `bun run db:pg:generate`
3. Apply migration: `bun run db:pg:migrate`

### Queuing Background Jobs

1. Define job type in `src/utils/redis/sqliteWriter.ts` or create new worker
2. Add to worker's `switch` statement
3. Enqueue from route: `await queue.enqueue(jobType, jobData)`

### IGDB Data Import Flow

```
User Request → searchGamesWithCache()
  ├─ Check Redis cache
  ├─ Query local SQLite
  └─ IGDB API (if not found)
       ↓
  Transform IGDB response
       ↓
  Enqueue INSERT_GAMES_BATCH
       ↓
SQLite Write Worker (background)
  ├─ Deduplicate
  ├─ Transactional insert
  ├─ Create relationships
  └─ Queue similar games
       ↓
Similar Games Worker (60s interval)
  ├─ Check system load
  ├─ Fetch missing similar games
  └─ Create bidirectional relationships
```

### User Game Import (CSV/JSON)

The import endpoint (`user/[username]/games/import.ts`) demonstrates:
- File parsing validation
- Checking for missing games in local database
- Fetching missing games from IGDB with `fetchAndSaveGamesFromIGDB()`
- Polling until games are available (queue processing delay)
- Batch insert into user's library

**Important:** The import uses a polling strategy with retries because the queue is async. Always account for queue processing time when reading recently enqueued data.

## Environment Variables

Required:
```bash
# Databases
POSTGRES_URL=postgresql://user:pass@host:5432/db
SQLITE_DATABASE_URL=./games.db  # Relative to project root

# Redis (Required)
REDIS_URL=redis://localhost:6379

# Authentication
BETTER_AUTH_SECRET=random-secret-min-32-chars
JWT_SECRET=another-random-secret

# IGDB API
TWITCH_CLIENT_ID=your-client-id
TWITCH_CLIENT_SECRET=your-client-secret

# Email Service
RESEND_API_KEY=re_xxxx
```

Optional:
```bash
OPENAI_API_KEY=sk-xxx           # For AI chat feature
SENTRY_DSN=https://xxx          # Error tracking
TRUSTED_ORIGINS=https://app.playdamnit.com,https://playdamnit.com
PORT=3030                       # Default port
NODE_ENV=development            # development or production
LOG_LEVEL=info                  # Logging verbosity

# Docker only
RUN_MIGRATIONS=true             # Auto-run migrations
RUN_SEED=false                  # Auto-seed database
```

## Common Development Scenarios

### Adding a New Game Field

1. Update SQLite schema: `db/sqlite/schema/index.ts`
2. Generate migration: `bun run db:sqlite:generate`
3. Update IGDB transformer: `src/utils/igdb/transformers.ts`
4. Update game type in `spec.yaml` for API client
5. Regenerate API client: `bun run orval:generate`

### Adding a New Queue Worker

1. Create worker file in `src/utils/redis/`
2. Extend `RedisQueue` class
3. Define job types and handler
4. Start worker in `src/index.ts` with `startWorkerInBackground()`

### Debugging Queue Issues

Check queue status:
```typescript
// In any file with Redis access
const pending = await redis.llen('sqlite_write:jobs');
const completed = await redis.scard('sqlite_write:completed');
const failed = await redis.smembers('sqlite_write:failed');
```

Worker logs are in `combined-*.log` with job IDs.

### Testing IGDB Integration

The IGDB API has rate limits. Use the local database first:
```typescript
// Always check local first
const localGames = await db.select()...;
if (localGames.length === 0) {
  // Then query IGDB
  const igdbGames = await searchIGDB(...);
}
```

## Performance Considerations

1. **Database Queries:** Use Drizzle's `with` for eager loading relationships instead of N+1 queries
2. **IGDB Batching:** Fetch up to 100 games per request (IGDB limit is 500, but 100 is safer)
3. **Redis Cache:** Always cache expensive IGDB searches (24-hour TTL is standard)
4. **Queue Load:** The similar games worker checks main queue length before processing
5. **SQLite Transactions:** All multi-row writes use transactions in the queue worker

## CI/CD

GitHub Actions:
- `.github/workflows/docker-publish.yml`: Builds and publishes Docker image to GHCR
- `.github/workflows/orval-client-generator.yml`: Auto-generates and publishes API client to npm

Both trigger on push to `master` and version tags.
