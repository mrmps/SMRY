/**
 * API Catch-all Route
 *
 * Mounts the Elysia server inside TanStack Start.
 * All requests to /api/* are handled by Elysia.
 */

import { createFileRoute } from "@tanstack/react-router";
import { app } from "../../server/index";

const handler = ({ request }: { request: Request }) => app.fetch(request);

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PUT: handler,
      DELETE: handler,
      PATCH: handler,
      HEAD: handler,
      OPTIONS: handler,
    },
  },
});
