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

    // Analytics
    CLICKHOUSE_URL: z.string().url(),
    CLICKHOUSE_USER: z.string().min(1),
    CLICKHOUSE_PASSWORD: z.string().min(1),
    CLICKHOUSE_DATABASE: z.string().min(1),

    // Alerting
    RESEND_API_KEY: z.string().min(1),
    ALERT_EMAIL: z.string().email(),

    // Admin auth
    ADMIN_SECRET: z.string().min(32),

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
