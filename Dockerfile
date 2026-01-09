# Use Node.js 20.18+ which has the undici memory leak fix
# CRITICAL: Node.js 20.15.1 or 20.18+ required to avoid Next.js 16 memory leak
# Node.js 22.x and 20.16.0-20.17.x are affected by the leak
# See: https://github.com/vercel/next.js/issues/85914
FROM node:20.15.1-alpine AS base

# Install bun for faster package installation
RUN npm install -g bun

# Install dependencies only
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
# Cache bust: 2026-01-09 - force clean install to remove stale jsdom
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

# Clerk publishable key for static page generation (public key, safe to expose)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# App URL for static generation
ARG NEXT_PUBLIC_URL=https://smry.ai
ENV NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL

RUN bun run build

# Production image - Node.js 20.18+ for memory leak fix
FROM node:20.15.1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy Next.js standalone build
COPY --chown=nodejs:nodejs --from=builder /app/public ./public
COPY --chown=nodejs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nodejs:nodejs --from=builder /app/.next/static ./.next/static

USER nodejs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use Node.js instead of Bun for production to avoid memory leaks
CMD ["node", "server.js"]
