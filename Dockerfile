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

# Set INTERNAL_API_URL for Next.js rewrites (build-time config)
# In production on Railway, this points to the smry-api service
ARG INTERNAL_API_URL=http://smry-api.railway.internal:3001
ENV INTERNAL_API_URL=$INTERNAL_API_URL

# Set NEXT_PUBLIC_API_URL for client-side API calls (build-time config)
# This makes the browser call the API directly, bypassing Next.js rewrites
ARG NEXT_PUBLIC_API_URL=https://api.smry.ai
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN bun run build

# Production image - Next.js only
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy Next.js standalone build
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
