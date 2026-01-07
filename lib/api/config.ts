/**
 * API Configuration
 * Routes directly to Elysia server (no Next.js proxy)
 */

export function getApiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  return `${base}${path}`;
}
