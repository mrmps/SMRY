/**
 * Eden Treaty Client
 *
 * Isomorphic API client that:
 * - On server (SSR): Calls Elysia directly (zero network overhead)
 * - On client: Makes HTTP requests to /api/*
 */

import { treaty } from "@elysiajs/eden";
import { createIsomorphicFn } from "@tanstack/react-start";
import type { App } from "../../server/index";

export const api = createIsomorphicFn()
  .server(async () => {
    // Dynamic import to avoid bundling server code in client
    const { app } = await import("../../server/index");
    return treaty<App>(app);
  })
  .client(() => {
    // On client, use current origin for API calls
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    return treaty<App>(origin);
  });

// Helper to get the API client
export async function getApi() {
  return api();
}
