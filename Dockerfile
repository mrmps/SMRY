FROM oven/bun:1 AS base

# Install dependencies only
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip env validation during build (vars not available at build time)
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# Production dependencies only (for Elysia server)
FROM base AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security (Debian-based image ships groupadd/useradd)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy Next.js standalone build (includes its own node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Elysia server source and runtime dependencies
COPY --from=builder /app/server ./server
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/types ./types
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose ports: Next.js (3000) and Elysia API (3001)
# Railway routes external traffic to PORT (3000), Elysia handles /api/* via internal routing
EXPOSE 3000 3001

ENV PORT=3000
ENV API_PORT=3001
ENV HOSTNAME="0.0.0.0"

# Railway handles health checks via railway.json healthcheckPath
# No Docker HEALTHCHECK needed (Railway monitors /health endpoint directly)

# Run both servers via entrypoint script
CMD ["./docker-entrypoint.sh"]
