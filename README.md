# playdamnit API

Elysia + Bun HTTP API for playdamnit. Game data comes from IGDB through the separate
`librarian` worker (`../librarian`); both talk through PostgreSQL (pg-boss + LISTEN/NOTIFY).
See `ARCHITECTURE.md` for the design and `CLAUDE.md` for conventions.

## Development

```bash
cp .env.example .env          # fill in POSTGRES_URL, TWITCH_* for the librarian, ...
bun install
bun run db:pg:migrate         # apply migrations
bun run dev                   # API on http://localhost:3030 (OpenAPI UI at /openapi)

cd ../librarian && bun install && bun run dev   # IGDB worker
```

A local Postgres is available with `bun run docker:compose:dev`.

## Database

PostgreSQL 17 with Drizzle ORM. `db/postgres/schema.ts` is the single schema for both services.

```bash
bun run db:pg:generate        # create a migration after changing the schema
bun run db:pg:migrate         # apply migrations (drizzle-kit)
bun run db:pg:studio          # browse data
```

## Tests

```bash
bun test                                                        # unit tests
TEST_POSTGRES_URL=postgres://user:pass@localhost:5432/playdamnit_test bun test
```

Integration tests truncate the database they're given; never point them at real data.

## Docker

```bash
cp .env.example .env          # POSTGRES_*, BETTER_AUTH_SECRET, RESEND_API_KEY, TWITCH_* are required
docker compose up -d --build
```

- `api` runs pending migrations on start (`RUN_MIGRATIONS=false` to skip) and exposes `/health`.
- `librarian` is built from the repo root (it reuses `backend/db/postgres`) and starts once
  `api` is healthy, i.e. after migrations.
- Postgres data lives in the `playdamnit-postgres-data` volume; the port is bound to 127.0.0.1.
