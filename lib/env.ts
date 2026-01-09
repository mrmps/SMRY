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

    // Analytics
    CLICKHOUSE_URL: z.string().url(),
    CLICKHOUSE_USER: z.string().min(1),
    CLICKHOUSE_PASSWORD: z.string().min(1),
    CLICKHOUSE_DATABASE: z.string().min(1),

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
  },

  runtimeEnv: {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    DIFFBOT_API_KEY: process.env.DIFFBOT_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    CLICKHOUSE_URL: process.env.CLICKHOUSE_URL,
    CLICKHOUSE_USER: process.env.CLICKHOUSE_USER,
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD,
    CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ALERT_EMAIL: process.env.ALERT_EMAIL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    API_PORT: process.env.API_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },

  emptyStringAsUndefined: true,
});
