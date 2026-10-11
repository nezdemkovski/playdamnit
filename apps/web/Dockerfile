# Build context: repository root
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com .
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

# Browser-facing API URL, inlined into the bundle at build time
ARG VITE_API_URL=http://localhost:3030
ENV VITE_API_URL=$VITE_API_URL
RUN bunx turbo run build --filter=@playdamnit/web

# The app is a static SPA: serve dist/ with nginx (unprivileged: runs as uid 101, writes only to /tmp)
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
