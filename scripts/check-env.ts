#!/usr/bin/env bun
/**
 * Pre-commit hook to validate all required environment variables are set.
 * Checks .env.local file for required vars.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const REQUIRED_VARS = [
  // Server
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CLERK_SECRET_KEY",
  "OPENROUTER_API_KEY",
  // Client
  "NEXT_PUBLIC_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
];

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key) vars[key] = rest.join("=").replace(/^["']|["']$/g, "");
  }
  return vars;
}

const envLocal = parseEnvFile(join(process.cwd(), ".env.local"));
const envFile = parseEnvFile(join(process.cwd(), ".env"));
const allVars = { ...envFile, ...envLocal, ...process.env };

const missing = REQUIRED_VARS.filter((v) => !allVars[v]);

if (missing.length > 0) {
  console.error("\x1b[31mMissing required environment variables:\x1b[0m");
  missing.forEach((v) => console.error(`  - ${v}`));
  console.error("\nAdd them to .env.local or set them in your environment.");
  process.exit(1);
}

console.log("\x1b[32mAll required environment variables are set.\x1b[0m");
