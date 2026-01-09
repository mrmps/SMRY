import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const isServerRuntime =
  typeof process !== "undefined" && typeof process.env !== "undefined";

const runtimeEnv = isServerRuntime
  ? {
      ...process.env,
    }
  : {
      ...import.meta.env,
    };

export const env = createEnv({
  /**
   * Client prefix for environment variables.
   * In Vite, we use VITE_ but also support NEXT_PUBLIC_ for migration.
   */
  clientPrefix: "NEXT_PUBLIC_",

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
    UPSTASH_REDIS_REST_URL: runtimeEnv.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: runtimeEnv.UPSTASH_REDIS_REST_TOKEN,
    CLERK_SECRET_KEY: runtimeEnv.CLERK_SECRET_KEY,
    OPENROUTER_API_KEY: runtimeEnv.OPENROUTER_API_KEY,
    DIFFBOT_API_KEY: runtimeEnv.DIFFBOT_API_KEY,
    CLICKHOUSE_URL: runtimeEnv.CLICKHOUSE_URL,
    CLICKHOUSE_USER: runtimeEnv.CLICKHOUSE_USER,
    CLICKHOUSE_PASSWORD: runtimeEnv.CLICKHOUSE_PASSWORD,
    CLICKHOUSE_DATABASE: runtimeEnv.CLICKHOUSE_DATABASE,
    ANALYTICS_SECRET_KEY: runtimeEnv.ANALYTICS_SECRET_KEY,
    CORS_ORIGIN: runtimeEnv.CORS_ORIGIN,
    API_PORT: runtimeEnv.API_PORT,
    LOG_LEVEL: runtimeEnv.LOG_LEVEL,
    NODE_ENV: runtimeEnv.NODE_ENV,
    RESEND_API_KEY: runtimeEnv.RESEND_API_KEY,
    ALERT_EMAIL: runtimeEnv.ALERT_EMAIL,

    // Client
    NEXT_PUBLIC_URL: runtimeEnv.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_LOGODEV_TOKEN: runtimeEnv.NEXT_PUBLIC_LOGODEV_TOKEN,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: runtimeEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_AD_CHECKOUT_URL: runtimeEnv.NEXT_PUBLIC_STRIPE_AD_CHECKOUT_URL,
  },

  /**
   * Skip validation in certain environments.
   * Set SKIP_ENV_VALIDATION=1 to skip (useful for Docker builds).
   */
  skipValidation: !!runtimeEnv.SKIP_ENV_VALIDATION,

  /**
   * Treat empty strings as undefined for optional fields.
   */
  emptyStringAsUndefined: true,
});
