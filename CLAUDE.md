# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## Monorepo

Bun workspaces + Turborepo. Use **Bun** only (never npm, node, pnpm or yarn for scripts and installs).

| Path                  | Package                  | What                                                               |
| --------------------- | ------------------------ | ------------------------------------------------------------------ |
| `apps/api`            | `@playdamnit/api`        | Elysia 2 HTTP API (Bun)                                            |
| `apps/librarian`      | `@playdamnit/librarian`  | pg-boss worker, sole owner of IGDB access (Bun)                    |
| `apps/web`            | `@playdamnit/web`        | React SPA: Vite, TanStack Router + Query, Tailwind                 |
| `packages/db`         | `@playdamnit/db`         | Drizzle schema, relations, migrations, migrator, job contract      |
| `packages/api-client` | `@playdamnit/api-client` | OpenAPI spec + orval-generated React Query client (workspace-only) |
| `packages/tsconfig`   | `@playdamnit/tsconfig`   | Shared tsconfig for Bun services                                   |

Workspace packages are imported by name (`@playdamnit/db/schema`, `@playdamnit/db/jobs`, ...) — never with relative paths across packages. `packages/db` ships TypeScript source; Bun and the bundler resolve it directly.

### No string literals for closed sets

Never write a value from a closed set (status, sort, kind, tab, mime type, header name, HTTP method, log namespace, date-fns pattern, ...) as a string literal. Use a TypeScript string `enum`; UI text goes through i18n (below).

- Shared by API and librarian: `packages/db/src/enums.ts` (`UserGameStatus`, `ReactionEmoji`, `WebhookEntity`, `ReleaseDatePrecision`, ...) and `SyncMode` in `src/jobs.ts`. `enumValues(E)` feeds Drizzle's `text(..., { enum })`.
- Service-local: `apps/api/src/utils/enums.ts`, `apps/librarian/src/utils/enums.ts`.
- Web: values that come from the API are enums generated into `@playdamnit/api-client` (orval `enumGenerationType: "enum"`; give members names with `x-enumNames` in `spec.yaml` when the values are not identifiers); the rest are in `apps/web/src/lib/enums.ts`.
- Not covered on purpose: UI text (i18n), error and log messages, CSS classes, property and column names, SQL, and values that belong to a library's own API (shadcn `variant`/`size`, HTML `type=`, AI SDK protocol strings in test fixtures, `credentials: "include"`).

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

See `docs/ARCHITECTURE.md` for flows and the schema and `docs/CATALOG_MIRROR_PLAN.md` for the rollout that is left (deployment, first full walk). In short:

- **Single PostgreSQL 18** for everything: catalog, users/sessions, and the pg-boss queue (`pgboss` schema — never touch it).
- **API** never calls IGDB. Search is local only (the catalog is a full mirror). When a library write references a game the catalog lacks, it enqueues `fetch-by-ids` and waits for `NOTIFY game_catalog_updated` (10s, 30s for imports).
- **Librarian** runs `fetch-by-ids`, `sync-catalog` (full walk by hand, incremental cron 02:00), `sync-lookups` (cron 03:30 + after start), `drain-dirty` (every minute), `refresh-stale-games` (cron 04:00), writes the catalog and NOTIFYs `{ requestId, ok }`.
- **IGDB webhooks**: the API receives them at `POST /api/webhooks/igdb/:entity/:method` (`src/routes/webhooks/igdb/POST.ts`, secret in `X-Secret`, compared in constant time) and only writes the game id to `catalog_dirty`; the librarian's `drain-dirty` claims rows with `FOR UPDATE SKIP LOCKED`, re-fetches the games and sets `deleted_at` on the ones IGDB no longer returns. The librarian registers the hooks on start when `WEBHOOK_BASE_URL` and `IGDB_WEBHOOK_SECRET` are set (`src/utils/igdb/webhooks.ts`).
- **Local platforms**: Steam Deck, Steam Machine and Steam Frame are rows in `platform` with ids from `LOCAL_PLATFORM_MIN_ID` (900000, migration `local_platforms`) because IGDB has no such platforms. `sync-lookups` only upserts by id, so they survive; `GET /api/catalog` returns them as `localPlatforms` and the web app adds them to the platform pickers (`src/hooks/platforms.ts`).
- **Catalog tables mirror IGDB**: every primary key (games, platforms, genres, companies, ...) is the IGDB id, never generated locally. Lookup rows are upserted by id; the migration `20261011005705_catalog_mirror_phase1` moved the old identity ids over with an embedded mapping.

### Database (`packages/db`)

- **Drizzle ORM 1.0 RC**. Tables: `src/schema.ts`; relations: `src/relations.ts` (`defineRelations`, RQB v2). Both apps use `node-postgres`: the API builds one `pg.Pool` in `apps/api/db/postgres/index.ts` (`drizzle({ client: pool, relations })`) shared with pg-boss, the librarian uses `drizzle(url, { relations })`. `numeric` columns come back as strings, Drizzle wraps driver errors in `DrizzleQueryError` with the `pg` error as `cause`.
- RQB v2 syntax: `where: { id: 1 }`, `where: { platforms: { id } }`, `where: { RAW: (t) => sql\`...\` }`, `orderBy: { addedAt: "desc" }`or`orderBy: (t) => [...]`. Inside `RAW`/`orderBy` callbacks use the table passed in (RQB aliases it).
- Many-to-many relations go `through` junction tables, so `with: { platforms: true }` returns platform rows.
- Migrations: `migrations/<timestamp>_<name>/{migration.sql,snapshot.json}` (drizzle-kit v1, no journal). For renames `drizzle-kit generate` asks for `--hints`. CI runs `db:check`. The API Docker entrypoint applies migrations on start (`src/migrate.ts`).
- Queue names, payloads and the NOTIFY channel live in `src/jobs.ts`. Both services `createQueue()` every queue on startup (pg-boss ≥ 10 requires it); work handlers receive an **array** of jobs.

### API (`apps/api`)

- **Elysia 2.0 beta (pinned)**; plugins from `@elysia/*`. The `apps/api/.claude/skills/elysiajs` docs describe 1.x — follow the notes below where they differ.
- Route options come **before** the handler: `.get("/path", { auth: true, query: t.Object(...) }, handler)`.
- Hooks have no `on` prefix. The global `.error()` in `src/index.ts` dispatches with `instanceof` (`ValidationError`, `ParseError`, `NotFound`, `ElysiaStatus`, our `AppError`). Validation errors map to 400 (Elysia's default is 422) to keep the API contract.
- Macros use the object form with `derive`; `src/lib/betterAuth.ts` derives `user`/`session` for `auth: true`.
- TypeBox 1.x: `t.Transform` is `t.Codec`. Use `t.Enum(SomeEnum)` for enums (checked at runtime: an optional `t.Enum` stays missing, unlike `t.UnionEnum`, which was filled with its first value).
- File-based routes in `src/routes/` (one file per method), composed in `src/routes/index.ts`. Routes stay thin; logic lives in `src/modules/*/service.ts`, shared request schemas in `src/modules/*/model.ts`. Services **throw** `AppError` subclasses (`src/utils/errors.ts`).
- Rate limits (`src/utils/rateLimit.ts`, in-memory per instance) guard search, import and AI chat.
- AI chat (`POST /api/chat/ai`): a `ToolLoopAgent` (AI SDK 7) in `src/modules/chat/agent.ts` with one `search_games` tool, streamed with `createAgentUIStreamResponse` (UI message stream protocol). The body is useChat's UI messages (`user`/`assistant` only) plus `showOnlyGames`. The tool returns full game cards to the UI but `toModelOutput` gives the model only id/name/year. Test with `MockLanguageModelV4` from `ai/test` (see the integration test) — never hit OpenAI from tests.
- `GET /api/games` takes filters (`genreId`, `platformId`, `year`, `releasedFrom/To`, `types`, `ids`, `mine=1` for the signed-in viewer's library, also on `release-days`) and `sort=id|popular|rating|recent|upcoming|wanted|played|date` (`GameService.findGames`); the detail adds `community` stats, `similarGames` cards and `viewer.liked`.
- Social layer: `modules/review` (reviews = entries with text; one emoji reaction per member from the `REACTION_EMOJIS` palette in `packages/db/src/schema.ts`, `allow_reactions` per entry), `modules/list` (ordered lists), `modules/user` (profile, follow, community search, notifications, feed, journal, avatars), playthroughs in `modules/userGame`. The profile's activity map is computed whole by `GET /api/user/:username/activity` (`UserService.activity`, one query: active days in the viewer's `tz`, levels 1-4 by quartiles); clients only draw it. Public routes that change with the viewer use the `viewer: true` macro (`src/lib/betterAuth.ts`); `auth: true` requires a session. Privacy helpers in `src/utils/social.ts`. Tests: `tests/social.integration.test.ts`.
- Search (`src/utils/searchGames.ts`): local only, over `game.search_names` (name + alternative names) with escaped ILIKE or pg_trgm word similarity (`<%`, GIN index), ranked by `similarity(name, q)`, popularity and rating count. Deleted games and editions (`version_parent_id`) are hidden unless `editions=1`; `types=0,8` filters by IGDB game_type id. Lists return a light card (`GAME_CARD_WITH` / `GAME_CARD_COLUMNS`); `GET /api/games/:id` adds screenshots, websites, similar games, developers/publishers, videos, store links, collections, themes, game modes, time to beat, localized covers, children (DLC) and editions, and serves deleted games with `deleted: true`.
- The card's `types` array is the single `game_type` lookup row (relation `gameTypeRef`), kept as an array for the client shape.
- Import: `UserGameService.importUserGames` fetches missing games in one job and writes in one transaction with `ON CONFLICT (user_id, game_id)`; CSV in `src/modules/userGame/csv.ts`.

#### Authentication (Better Auth 1.7)

- `src/lib/auth.ts`: email/password (verification and password reset only when `RESEND_API_KEY` is set; otherwise sign-up needs no verification), passkeys (`@better-auth/passkey`; `rpID` is the hostname of `BETTER_AUTH_URL`, allowed origins = `TRUSTED_ORIGINS` plus localhost:3000/3030 in development), API keys (`@better-auth/api-key`, keys owned by `referenceId`), admin, username, Sign in with Apple (the iOS app posts its ID token to `sign-in/social`, audience `APPLE_APP_BUNDLE_ID`; the web's redirect flow only with `APPLE_CLIENT_ID`/`APPLE_CLIENT_SECRET`; Apple accounts link to the same email and start without a username, which the app asks for). `user.deleteUser` (password-confirmed, rows cascade) and `user.changeEmail` are enabled; with email on, a change is verified from the new address, without it the address is applied directly. `BETTER_AUTH_URL` must be the API's public URL (defaults to http://localhost:3030 in development).
- The auth tables are passed to `drizzleAdapter(db, { schema })` explicitly — Drizzle v1 clients carry no schema.
- The auth tables live in `packages/db/src/schema.ts`; after a Better Auth upgrade compare them with `bunx @better-auth/cli generate` output (the config loads under Node now that the driver is `node-postgres`).
- Auth endpoints are served by the `/api/auth/*` route in `src/index.ts`; don't also `.mount()` the handler.
- **Demo account** (`src/modules/demo/service.ts`): one shared member with `role = demo` (`UserRole.Demo`), named by `DEMO_USERNAME`/`DEMO_PASSWORD` (without both the demo is off). `POST /api/demo/session` signs the caller into it (rate limited per IP, sessions last a day) and forwards Better Auth's cookies; `GET /api/me` answers `demo: true`. It is read only: the `auth` macro answers every non-GET with 403 `{ code: "DEMO_READ_ONLY" }`, and a `hooks.before` in `src/lib/auth.ts` refuses Better Auth's own endpoints except sign-out and the ways into another account (`DemoAuthPath`). It never shows to members: `requireUser`/`findByUsername` 404 for anyone else, `notDemo()` filters member search, follow lists and taste matches, and its list is private. `bun run scripts/demo-account.ts create|unlock|lock` makes it, opens it to fill its library with the apps, and locks it again.

### Librarian (`apps/librarian`)

- IGDB client in `src/utils/igdb/`: requests ≥ 260ms apart (IGDB allows 4/s), up to 500 ids per request with an explicit `limit`, Apicalypse-escaped search strings, errors are thrown so pg-boss retries.
- Every game write goes through `src/catalog/writeGames.ts`: one transaction per batch of up to 500 expanded IGDB documents (`GAME_FIELDS` in `src/utils/igdb/utils.ts`), bulk upserts per table, `game.raw` keeps the document, `src/catalog/derive.ts` (pure, unit-tested) turns it into rows. Similar games are `game.similar_game_ids`; there is no crawl.
- `sync-catalog` walks `/games` by id (full) or `updated_at` (incremental), 10 pages per job, re-enqueuing itself with the cursor (`sync_state`). Start a full walk with `bun run scripts/enqueue.ts sync-catalog full` from `apps/librarian`.
- Upserts refresh columns with `excluded.<column>`; build the `set` map from `getTableColumns` (property keys), Drizzle drops unknown keys silently.

### API client (`packages/api-client`)

- `spec.yaml` is the hand-maintained OpenAPI contract. **Update it with every route change.** `bun run generate` runs orval (`index.ts` is generated and gitignored), `build` bundles it.
- Enums in the spec become real TypeScript enums (`StatusEnum.Finished`), see "No string literals" above. Calls return the response body directly (the axios mutator unwraps `response.data`). Apps set the API URL with `configureApiClient({ baseURL })`; `generated.ts` is orval output (gitignored), `index.ts` is the hand-written entry.
- The package is consumed only by `apps/web` through the workspace; it is not published anywhere.

### Web (`apps/web`)

- Client-side SPA on **Vite 8**, **TanStack Router** (file-based, `src/routes/`; `src/routeTree.gen.ts` is generated by the Vite plugin — commit it, don't edit it), **TanStack Query** and **Tailwind 4** (`@tailwindcss/vite`). No SSR, no server code.
- Routes: `/` (home: friends feed, this week, trending, fresh reviews), `/changelog`, `/auth`, `/search?q=`, `/calendar`, `/charts`, `/community`, `/notifications`, `/games/$id`, `/lists/$id`, `/$username` (layout with tabs: overview, games, journal, reviews, lists, friends, likes), `/$username/settings` (`$username_.settings.tsx`, outside the layout). Search is also a ⌘K dialog. Social hooks live in `src/hooks/social.ts`, the profile tab context in `src/hooks/profile.ts`.
- **shadcn/ui** components live in `src/components/ui/` and are kept exactly as the CLI ships them (`bunx shadcn@latest add <name>`; excluded from oxlint/oxfmt). Never edit those files: theme them through the CSS variables in `src/globals.css` and style around them with `className`. `cn` comes from the `cn` package.
- Design: the "scoreboard" look (`src/globals.css`): cool near-black `#0f1012`, hairline rules, zero radius, Archivo Black headings, JetBrains Mono numbers (`num`, `eyebrow`), one red `#ff2b2b` and acid `#d7ff3b` only for finished. No background grid, no hover shadows, buttons in sentence case with no letter-spacing. The logo is a red tile with a tilted black exclamation mark and no wordmark. Copy is short, sarcastic and tied to real numbers (`src/lib/voice.ts`); status metadata (label, icon, colour classes) is in `src/lib/statuses.ts`, dates, ratings and IGDB game types in `src/lib/format.ts`, IGDB image size swapping in `src/lib/image.ts`.
- i18n (`src/i18n/`): i18next + react-i18next, English only for now. **All UI text lives in `src/i18n/locales/en.json`** (nested keys by area: `home.*`, `profile.*`, `settings.*`, `toast.*`, `voice.*`, ...). `i18next.d.ts` types every key from that file, so a wrong `t("...")` fails `tsc`. Never hardcode user-facing text: use `useTranslation()` in components and the global `t` from `@/i18n` in plain modules (`voice.ts`, `format.ts`, hooks). Plurals are `key_one`/`key_other` with `count`, rich text uses `<Trans i18nKey components={{ n: <b /> }} />`, dates go through `@/i18n/date` (date-fns with the active locale). `main.tsx` remounts the tree on language change, so module-level getters refresh. Not translated on purpose: IGDB data, user-written text and API error messages. To add a language: drop `<code>.json` next to `en.json`, register it in `resources` and `SUPPORTED_LANGUAGES`, and add its date-fns locale in `date.ts`.
- Data access goes through the generated client (`@playdamnit/api-client` hooks) wrapped in `src/hooks/library.ts` (list, add/update/remove with cache invalidation, import) and `src/hooks/auth.ts` (Better Auth session, sign-in/up/out, profile, password, passkeys). Mutations toast errors with sonner.
- Links and navigation are typed: `<Link to="/$username" params={{ username }}>`, `navigate({ to: "/auth" })` — never build paths with template strings.
- The AI assistant (`src/components/assistant-dialog.tsx`, lazy-loaded) uses `useChat` from `@ai-sdk/react` with a `DefaultChatTransport`; its message type (`src/lib/chat.ts`) mirrors the API's `search_games` tool. Keep `ai`/`@ai-sdk/react` on the same major as the API's `ai`.
- The session comes from Better Auth's React client (`src/lib/authClient.ts`, `useSession` in `src/hooks/auth.ts`). In development sign-up requires email verification and the link is printed in the API log.
- Config is `import.meta.env.VITE_API_URL` (see `src/config.ts`), inlined at build time. `src/main.tsx` calls `configureApiClient({ baseURL })` before rendering.
- Production image is nginx serving `dist/` with an SPA fallback (`apps/web/nginx.conf`).

## Lint & format (Oxc)

- **Oxlint** (`.oxlintrc.json`) and **Oxfmt** (`.oxfmtrc.json`) run once over the whole repo from the root — there are no ESLint or Prettier configs. Web files get the `react` and `jsx-a11y` plugins.
- `apps/web/src/components/ui/**` (shadcn/ui as shipped) is excluded from both.

## Logging & errors

Winston with daily rotating files (`LOG_DIR`, default `./logs`) and Sentry when `SENTRY_DSN` is set (20% traces in production). The API and the librarian have their own Sentry projects (`playdamnit-api`, `playdamnit-librarian`; DSNs in 1Password `playdamnit` as `SENTRY_DSN_API` and `SENTRY_DSN_LIBRARIAN`, read by the gitops ExternalSecrets). Every log line at `LOG_LEVEL` goes to Sentry Logs through a winston transport; `logger.error`/`exception` also make issues, warnings stay logs. Releases are `<service>@<APP_VERSION>` (the charts pass their appVersion). Librarian jobs wrap their handler in `reported(queue, handler)` (`src/workers/reported.ts`), so a failure is logged and tagged with its queue before pg-boss retries it.

## Testing

```bash
bun run test                                                        # unit tests
TEST_POSTGRES_URL=postgres://.../playdamnit_test bun run test       # + integration (DB gets truncated)
```

`apps/api/tests/setup.ts` overrides `POSTGRES_URL` so tests never touch the database from `.env`.

## Docker, Helm & CI

- Dockerfiles live in each app and build from the **repo root** with `turbo prune` (`docker build -f apps/api/Dockerfile .`). `docker compose up -d --build` runs postgres, api (runs migrations, `/health`), librarian and web. Images run as non-root on a read-only root filesystem (`LOG_DIR=/tmp/logs`; the web image is nginx-unprivileged).
- Helm charts in `charts/playdamnit-{api,librarian,web}` (scaffolded with `helm create`): `version`/`appVersion` is the release number, the image tag defaults to `appVersion`. Bump all three together. New features after the 1.0 entry go into `apps/web/src/changelog.ts` (the `/changelog` page; its text in `src/i18n/locales/changelog/en.json`, the `changelog` namespace) in the commit that ships them, as what members can now do; fixes, polish and layout moves are not listed. The homelab deployment (Flux, `homelab-gitops`) is described in `docs/CATALOG_MIRROR_PLAN.md`.
- `.github/workflows`: `ci.yml` (oxlint, oxfmt check, db:check, typecheck, test with Postgres, build, helm lint/template), `docker-publish.yml` (images per app to GHCR tagged with the chart appVersion, charts to `oci://ghcr.io/nezdemkovski/charts`).
