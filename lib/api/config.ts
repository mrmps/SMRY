/**
 * API Configuration
 *
 * All API calls use relative URLs (e.g., /api/summary).
 * Next.js rewrites proxy these to the internal Elysia server (localhost:3001).
 *
 * This works identically in both dev and prod:
 * - Dev: Next.js dev server rewrites → localhost:3001
 * - Prod: Next.js standalone rewrites → localhost:3001
 */

export function getApiUrl(path: string): string {
  return path;
}
