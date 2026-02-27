import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

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
    RESEND_API_KEY: z.string().min(1),
    ALERT_EMAIL: z.string().email(),

    // Server config
    CORS_ORIGIN: z.string().min(1),
    API_PORT: z.coerce.number().default(3001),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },

  client: {
    NEXT_PUBLIC_URL: z.string().url(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_CLERK_PATRON_PLAN_ID: z.string().min(1),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  },

  runtimeEnv: {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    DIFFBOT_API_KEY: process.env.DIFFBOT_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    POSTHOG_PROJECT_ID: process.env.POSTHOG_PROJECT_ID,
    POSTHOG_PERSONAL_API_KEY: process.env.POSTHOG_PERSONAL_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ALERT_EMAIL: process.env.ALERT_EMAIL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    API_PORT: process.env.API_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_PATRON_PLAN_ID: process.env.NEXT_PUBLIC_CLERK_PATRON_PLAN_ID,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },

  emptyStringAsUndefined: true,
});
