FROM oven/bun:1.4 AS base

WORKDIR /app

# Install dependencies
COPY package.json bun.lock tsconfig.json drizzle.postgres.config.ts ./
RUN bun install --frozen-lockfile --production

# Copy source code, schema and migrations
COPY src/ src/
COPY db/ db/
COPY scripts/migrate.ts scripts/migrate.ts

ENV PORT=3030
ENV NODE_ENV=production
ENV RUN_MIGRATIONS=true

EXPOSE 3030

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3030) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
