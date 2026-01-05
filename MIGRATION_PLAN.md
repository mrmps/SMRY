# Vercel + Railway Deployment Guide

## Overview

This document outlines how to deploy the 13ft Next.js application on **either Vercel or Railway** (or both).

**Current Stack:**
- Next.js 16.0.7 (App Router)
- Upstash Redis (external - works on both platforms)
- Clerk Authentication (external - works on both platforms)
- Stripe Payments (external - works on both platforms)

---

## Environment Variables

Both platforms need these environment variables:

**Public Variables:**
```
NEXT_PUBLIC_URL=https://your-domain.com
NEXT_PUBLIC_LOGODEV_TOKEN=<value>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<value>
NEXT_PUBLIC_CLERK_PATRON_PLAN_ID=<value>
```

**Private Variables:**
```
OPENAI_API_KEY=<value>
UPSTASH_REDIS_REST_URL=<value>
UPSTASH_REDIS_REST_TOKEN=<value>
DIFFBOT_API_KEY=<value>
CLERK_SECRET_KEY=<value>
OPENROUTER_API_KEY=<value>
RESEND_API_KEY=<value>
PERPLEXITY_API_KEY=<value>
GEMINI_API_KEY=<value>
TOGETHER_API_KEY=<value>
EMAIL_TO_ADDRESS=<value>
NODE_ENV=production
```

---

## Option A: Deploy on Vercel

### Setup

1. Connect GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

Vercel auto-detects Next.js and handles everything. No additional configuration needed.

### Custom Domain

1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS as instructed

---

## Option B: Deploy on Railway

### Setup

1. Create Railway account at [railway.app](https://railway.app)
2. Create new project and link GitHub repo
3. Add environment variables in Railway dashboard

### Configuration

Create `railway.json` in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Recommended: Standalone Build

Add to `next.config.js` for optimized Railway builds:

```javascript
const nextConfig = {
  output: 'standalone',  // ADD THIS LINE
  // ... existing config
}
```

### Alternative: Dockerfile

If Nixpacks has issues, create a `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Custom Domain

1. In Railway project settings, go to Domains
2. Add custom domain
3. Configure DNS with CNAME to `your-project.up.railway.app`

---

## External Service Configuration

When changing domains, update these services:

### Clerk Dashboard
1. Go to Settings > Domains
2. Add your deployment domain
3. Update allowed redirect URLs

### Stripe Dashboard
1. Go to Developers > Webhooks
2. Update webhook endpoint URL
3. Update success/cancel URLs in checkout config

---

## Testing Checklist

After deployment, verify:

- [ ] Homepage loads
- [ ] Article fetching works (`/api/article`)
- [ ] Summary generation streams correctly (`/api/summary`)
- [ ] Authentication works (Clerk sign in/up)
- [ ] Premium features work (Stripe checkout)
- [ ] Redis caching works
- [ ] Image optimization works
- [ ] i18n routing works (`/en`, `/es`, `/fr`)

---

## Cost Comparison

| Platform | Base Cost | Notes |
|----------|-----------|-------|
| Vercel Pro | ~$20/month | Generous free tier, auto-scaling |
| Railway Hobby | $5/month + usage | Usage-based, good for predictable traffic |
| Railway Pro | $20/month + usage | Team features, more resources |

---

## Support Resources

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Next.js on Railway Guide](https://docs.railway.app/guides/nextjs)
