import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Server-only environment variables for smry-api.
 * This is separate from lib/env.ts because the backend doesn't need
 * NEXT_PUBLIC_* variables, and @t3-oss/env-nextjs requires them.
 */
export const env = createEnv({
  server: {
    // Auth
    CLERK_SECRET_KEY: z.string().min(1),

    // AI/API
    OPENROUTER_API_KEY: z.string().min(1),
    DIFFBOT_API_KEY: z.string().min(1),

    // Cache
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

    // Analytics (PostHog) - optional, gracefully degrades when not set
    POSTHOG_API_KEY: z.string().optional(),
    POSTHOG_HOST: z.string().url().optional(),
    POSTHOG_PROJECT_ID: z.string().optional(),
    POSTHOG_PERSONAL_API_KEY: z.string().optional(),

    // Alerting
    ALERT_EMAIL: z.string().email(),

    // Gravity Ads
    GRAVITY_API_KEY: z.string().min(1),

    // Email (inbound.new)
    INBOUND_API_KEY: z.string().min(1),
    INBOUND_WEBHOOK_TOKEN: z.string().optional(),

    // Clerk Webhooks
    CLERK_WEBHOOK_SECRET: z.string().min(1),

    // Admin auth
    ADMIN_SECRET: z.string().min(1),

    // Server config
    CORS_ORIGIN: z.string().min(1),
    API_PORT: z.coerce.number().default(3001),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  runtimeEnv: process.env,

  emptyStringAsUndefined: true,
});
