import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema.
   * These are not available on the client.
   */
  server: {
    // Required
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),

    // Required - AI/API keys
    OPENROUTER_API_KEY: z.string().min(1),
    DIFFBOT_API_KEY: z.string().min(1).optional(),

    // Optional - Clickhouse Analytics
    CLICKHOUSE_URL: z.string().url().optional(),
    CLICKHOUSE_USER: z.string().default("default"),
    CLICKHOUSE_PASSWORD: z.string().optional(),
    CLICKHOUSE_DATABASE: z.string().default("smry_analytics"),
    ANALYTICS_SECRET_KEY: z.string().optional(),

    // Optional - Server config
    CORS_ORIGIN: z.string().optional(),
    API_PORT: z.coerce.number().default(3001),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

    // Optional - Alerting
    RESEND_API_KEY: z.string().optional(),
    ALERT_EMAIL: z.string().email().optional(),

    // Node.js built-in
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },

  /**
   * Client-side environment variables schema.
   * Must be prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_URL: z.string().url(),
    NEXT_PUBLIC_LOGODEV_TOKEN: z.string().optional(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_STRIPE_AD_CHECKOUT_URL: z.string().url().optional(),
  },

  /**
   * Runtime environment variables.
   * Due to how Next.js bundles env vars, we need to destructure them manually.
   */
  runtimeEnv: {
    // Server
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    DIFFBOT_API_KEY: process.env.DIFFBOT_API_KEY,
    CLICKHOUSE_URL: process.env.CLICKHOUSE_URL,
    CLICKHOUSE_USER: process.env.CLICKHOUSE_USER,
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD,
    CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE,
    ANALYTICS_SECRET_KEY: process.env.ANALYTICS_SECRET_KEY,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    API_PORT: process.env.API_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ALERT_EMAIL: process.env.ALERT_EMAIL,

    // Client
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_LOGODEV_TOKEN: process.env.NEXT_PUBLIC_LOGODEV_TOKEN,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_AD_CHECKOUT_URL: process.env.NEXT_PUBLIC_STRIPE_AD_CHECKOUT_URL,
  },

  /**
   * Treat empty strings as undefined for optional fields.
   */
  emptyStringAsUndefined: true,
});
