# Build context: repository root
#   docker build -f apps/librarian/Dockerfile .
FROM oven/bun:1.4 AS pruner
WORKDIR /repo
COPY . .
RUN bunx turbo@2.11.7 prune @playdamnit/librarian --docker

FROM oven/bun:1.4 AS runner
WORKDIR /repo

COPY --from=pruner /repo/out/json/ .
RUN bun install --frozen-lockfile --production
COPY --from=pruner /repo/out/full/ .

WORKDIR /repo/apps/librarian
ENV NODE_ENV=production

ENTRYPOINT ["bun", "run", "src/index.ts"]
