# syntax=docker.io/docker/dockerfile:1
# Build context: repository root
#   docker build -f apps/web/Dockerfile .
FROM oven/bun:1.4 AS pruner
WORKDIR /repo
COPY . .
# Keep only the web app and the workspace packages it depends on (api-client)
RUN bunx turbo@2.11.7 prune @playdamnit/web --docker

FROM oven/bun:1.4 AS builder
WORKDIR /repo

COPY --from=pruner /repo/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .

# Public env is inlined into the client bundle at build time
ARG BACKEND_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN bunx turbo run build --filter=@playdamnit/web

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone output mirrors the monorepo layout (outputFileTracingRoot is the repo root)
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
