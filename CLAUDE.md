# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## Monorepo

Bun workspaces + Turborepo. Use **Bun** only (never npm, node, pnpm or yarn for scripts and installs).

| Path                  | Package                  | What                                                                 |
| --------------------- | ------------------------ | -------------------------------------------------------------------- |
| `apps/api`            | `@playdamnit/api`        | Elysia 2 HTTP API (Bun)                                              |
| `apps/librarian`      | `@playdamnit/librarian`  | pg-boss worker, sole owner of IGDB access (Bun)                      |
| `apps/web`            | `@playdamnit/web`        | React SPA: Vite, TanStack Router + Query, Tailwind                   |
| `packages/db`         | `@playdamnit/db`         | Drizzle schema, relations, migrations, migrator, job contract        |
| `packages/api-client` | `@playdamnit/api-client` | OpenAPI spec + orval-generated React Query client (published to npm) |
| `packages/tsconfig`   | `@playdamnit/tsconfig`   | Shared tsconfig for Bun services                                     |

Workspace packages are imported by name (`@playdamnit/db/schema`, `@playdamnit/db/jobs`, ...) — never with relative paths across packages. `packages/db` ships TypeScript source; Bun and the bundler resolve it directly.

### Commands (repo root)

```bash
bun install                 # one lockfile for everything
bun run db:up               # local Postgres (docker-compose.dev.yml)
bun run db:migrate          # apply migrations (uses POSTGRES_URL from apps/api/.env)
bun run dev                 # api + librarian + web with hot reload (turbo)
bun run dev:backend         # api + librarian only
bun run typecheck           # all packages
bun run test                # unit tests; set TEST_POSTGRES_URL for integration tests
bun run build               # api-client + web
bun run lint                # oxlint over the whole repo (lint:fix to autofix)
bun run format              # oxfmt (format:check in CI)
bun run db:generate         # new migration after changing packages/db/src/schema.ts
bun run db:studio
```

Filter any task with `bunx turbo run <task> --filter=@playdamnit/<name>`. `api-client` is generated (`generate`) and built before anything that depends on it.

### Environment

- `apps/api/.env`, `apps/librarian/.env`, `apps/web/.env.local` for local runs (see the `.example` files). Bun loads `.env` from the app directory.
- Root `.env` (see `.env.example`) feeds `docker-compose.yml`.

## Architecture

The catalog is moving to a full IGDB mirror, see `docs/CATALOG_MIRROR_PLAN.md`. Current state in short:

- **Single PostgreSQL 18** for everything: catalog, users/sessions, and the pg-boss queue (`pgboss` schema — never touch it).
- **API** never calls IGDB. On catalog misses it enqueues pg-boss jobs and waits for `NOTIFY game_catalog_updated` (10s, 30s for imports).
- **Librarian** runs `search-igdb`, `fetch-by-ids`, `process-similar-games`, `refresh-stale-games` (cron 04:00), `sync-lookups` (cron 03:30 + after start), writes the catalog and NOTIFYs `{ requestId, ok }`.
- **Catalog tables mirror IGDB**: every primary key (games, platforms, genres, companies, ...) is the IGDB id, never generated locally. Lookup rows are upserted by id; the migration `20261011005705_catalog_mirror_phase1` moved the old identity ids over with an embedded mapping.

### Database (`packages/db`)

- **Drizzle ORM 1.0 RC**. Tables: `src/schema.ts`; relations: `src/relations.ts` (`defineRelations`, RQB v2). Each app builds its own client (`apps/api/db/postgres/index.ts` with `bun-sql`, `apps/librarian/db/postgres/index.ts` with `node-postgres`) via `drizzle(url, { relations })`.
- RQB v2 syntax: `where: { id: 1 }`, `where: { platforms: { id } }`, `where: { RAW: (t) => sql\`...\` }`, `orderBy: { addedAt: "desc" }`or`orderBy: (t) => [...]`. Inside `RAW`/`orderBy` callbacks use the table passed in (RQB aliases it).
- Many-to-many relations go `through` junction tables, so `with: { platforms: true }` returns platform rows.
- Migrations: `migrations/<timestamp>_<name>/{migration.sql,snapshot.json}` (drizzle-kit v1, no journal). For renames `drizzle-kit generate` asks for `--hints`. CI runs `db:check`. The API Docker entrypoint applies migrations on start (`src/migrate.ts`).
- Queue names, payloads and the NOTIFY channel live in `src/jobs.ts`. Both services `createQueue()` every queue on startup (pg-boss ≥ 10 requires it); work handlers receive an **array** of jobs.

### API (`apps/api`)

- **Elysia 2.0 beta (pinned)**; plugins from `@elysia/*`. The `apps/api/.claude/skills/elysiajs` docs describe 1.x — follow the notes below where they differ.
- Route options come **before** the handler: `.get("/path", { auth: true, query: t.Object(...) }, handler)`.
- Hooks have no `on` prefix. The global `.error()` in `src/index.ts` dispatches with `instanceof` (`ValidationError`, `ParseError`, `NotFound`, `ElysiaStatus`, our `AppError`). Validation errors map to 400 (Elysia's default is 422) to keep the API contract.
- Macros use the object form with `derive`; `src/lib/betterAuth.ts` derives `user`/`session` for `auth: true`.
- TypeBox 1.x: `t.Transform` is `t.Codec`. Use `t.Union([t.Literal(...)])` for enums — an optional `t.UnionEnum` was filled with its first value (unit-tested).
- File-based routes in `src/routes/` (one file per method), composed in `src/routes/index.ts`. Routes stay thin; logic lives in `src/modules/*/service.ts`, shared request schemas in `src/modules/*/model.ts`. Services **throw** `AppError` subclasses (`src/utils/errors.ts`).
- Rate limits (`src/utils/rateLimit.ts`, in-memory per instance) guard search, import and AI chat.
- AI chat (`POST /api/chat/ai`): a `ToolLoopAgent` (AI SDK 7) in `src/modules/chat/agent.ts` with one `search_games` tool, streamed with `createAgentUIStreamResponse` (UI message stream protocol). The body is useChat's UI messages (`user`/`assistant` only) plus `showOnlyGames`. The tool returns full game cards to the UI but `toModelOutput` gives the model only id/name/year. Test with `MockLanguageModelV4` from `ai/test` (see the integration test) — never hit OpenAI from tests.
- Search: escaped ILIKE + pg_trgm `%` (GIN index). IGDB is asked on the first page when there are < 3 substring matches and the query wasn't searched within 7 days (`igdb_search_log`, claimed atomically). Lists return a light card (`GAME_CARD_WITH`); screenshots, websites and similar games only come with `GET /api/games/:id`.
- Import: `UserGameService.importUserGames` fetches missing games in one job and writes in one transaction with `ON CONFLICT (user_id, game_id)`; CSV in `src/modules/userGame/csv.ts`.

#### Authentication (Better Auth 1.7)

- `src/lib/auth.ts`: email/password with verification, passkeys (`@better-auth/passkey`), API keys (`@better-auth/api-key`, keys owned by `referenceId`), admin, username.
- The auth tables are passed to `drizzleAdapter(db, { schema })` explicitly — Drizzle v1 clients carry no schema.
- The Better Auth CLI can't load the config (Node vs `bun-sql`): keep the auth tables in `packages/db/src/schema.ts` in sync by hand when upgrading.
- Auth endpoints are served by the `/api/auth/*` route in `src/index.ts`; don't also `.mount()` the handler.

### Librarian (`apps/librarian`)

- IGDB client in `src/utils/igdb/`: requests ≥ 260ms apart (IGDB allows 4/s), up to 500 ids per request with an explicit `limit`, Apicalypse-escaped search strings, errors are thrown so pg-boss retries.
- Similar-games crawl is bounded by `SIMILAR_GAMES_MAX_DEPTH` (default 1). Writes are upserts so refreshes update existing games.

### API client (`packages/api-client`)

- `spec.yaml` is the hand-maintained OpenAPI contract. **Update it with every route change.** `bun run generate` runs orval (`index.ts` is generated and gitignored), `build` bundles it.
- Calls return the response body directly (the axios mutator unwraps `response.data`). Apps set the API URL with `configureApiClient({ baseURL })`; `generated.ts` is orval output (gitignored), `index.ts` is the hand-written entry.
- Changes to `spec.yaml`, `index.ts`, `custom-axios.ts` or `orval.config.mjs` on `master` publish a new patch version to npm.

### Web (`apps/web`)

- Client-side SPA on **Vite 8**, **TanStack Router** (file-based, `src/routes/`; `src/routeTree.gen.ts` is generated by the Vite plugin — commit it, don't edit it), **TanStack Query** and **Tailwind 4** (`@tailwindcss/vite`). No SSR, no server code.
- Links and navigation are typed: `<Link to="/$username" params={{ username }}>`, `navigate({ to: "/auth" })` — never build paths with template strings.
- The AI assistant (`src/components/ai-chat-modal.tsx`) uses `useChat` from `@ai-sdk/react` with a `DefaultChatTransport`; its message type (`src/lib/chat.ts`) mirrors the API's `search_games` tool. Keep `ai`/`@ai-sdk/react` on the same major as the API's `ai`.
- The session comes from Better Auth's React client (`src/lib/authClient.ts`, `useSession` in `src/hooks/auth.ts`).
- Config is `import.meta.env.VITE_API_URL` (see `src/config.ts`), inlined at build time. `src/main.tsx` calls `configureApiClient({ baseURL })` before rendering.
- Production image is nginx serving `dist/` with an SPA fallback (`apps/web/nginx.conf`).

## Lint & format (Oxc)

- **Oxlint** (`.oxlintrc.json`) and **Oxfmt** (`.oxfmtrc.json`) run once over the whole repo from the root — there are no ESLint or Prettier configs. Web files get the `react` and `jsx-a11y` plugins.
- `no-unused-vars` is a warning while legacy frontend code is cleaned up; new code should not add to it.

## Logging & errors

Winston with daily rotating files (`LOG_DIR`, default `./logs`) and Sentry when `SENTRY_DSN` is set (20% traces in production).

## Testing

```bash
bun run test                                                        # unit tests
TEST_POSTGRES_URL=postgres://.../playdamnit_test bun run test       # + integration (DB gets truncated)
```

`apps/api/tests/setup.ts` overrides `POSTGRES_URL` so tests never touch the database from `.env`.

## Docker & CI

- Dockerfiles live in each app and build from the **repo root** with `turbo prune` (`docker build -f apps/api/Dockerfile .`). `docker compose up -d --build` runs postgres, api (runs migrations, `/health`), librarian and web.
- `.github/workflows`: `ci.yml` (oxlint, oxfmt check, db:check, typecheck, test with Postgres, build), `docker-publish.yml` (images per app to GHCR), `orval-client-generator.yml` (publishes the client).
