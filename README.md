# playdamnit

Game backlog tracker. Bun workspaces + Turborepo monorepo.

```
apps/
  api/         Elysia 2 HTTP API
  librarian/   pg-boss worker that owns all IGDB access
  web/         React SPA (Vite, TanStack Router + Query, Tailwind)
packages/
  db/          Drizzle schema, relations, migrations, job contract
  api-client/  OpenAPI spec + generated React Query client (@playdamnit/api-client on npm)
  tsconfig/    shared TypeScript config
```

## Getting started

```bash
bun install
cp apps/api/.env.example apps/api/.env               # + RESEND/OPENAI keys if needed
cp apps/librarian/.env.example apps/librarian/.env   # TWITCH_CLIENT_ID / _SECRET for IGDB
cp apps/web/.env.local.example apps/web/.env.local

bun run db:up        # Postgres in Docker
bun run db:migrate
bun run dev          # api :3030, web :3000, librarian
```

## Everyday commands

| Command                                    |                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `bun run dev` / `bun run dev:backend`      | everything / api + librarian, hot reload                                 |
| `bun run typecheck`                        | all packages                                                             |
| `bun run test`                             | unit tests (`TEST_POSTGRES_URL=... bun run test` adds integration tests) |
| `bun run build`                            | api client + web                                                         |
| `bun run lint` / `bun run format`          | Oxlint / Oxfmt over the whole repo                                       |
| `bun run db:generate`                      | migration after editing `packages/db/src/schema.ts`                      |
| `bun run db:migrate` / `bun run db:studio` | apply migrations / browse data                                           |

API changes: update `packages/api-client/spec.yaml`, then `bun run generate`.

## Docker

```bash
cp .env.example .env    # POSTGRES_*, BETTER_AUTH_SECRET, RESEND_API_KEY, TWITCH_* are required
docker compose up -d --build
```

Each app has its own Dockerfile built from the repo root (`docker build -f apps/api/Dockerfile .`).

See `docs/ARCHITECTURE.md` for how the services fit together, `docs/CATALOG_MIRROR_PLAN.md` for the remaining rollout and `CLAUDE.md` for conventions.
