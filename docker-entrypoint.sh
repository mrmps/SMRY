#!/bin/sh
# Docker entrypoint script
# Runs both the Elysia API server (port 3001) and Next.js server (port 3000)

set -e

echo "Starting Elysia API server on port ${API_PORT:-3001}..."
bun run server/index.ts &
ELYSIA_PID=$!

echo "Starting Next.js server on port ${PORT:-3000}..."
bun server.js &
NEXT_PID=$!

# Handle shutdown signals
cleanup() {
  echo "Shutting down servers..."
  kill $ELYSIA_PID $NEXT_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGTERM SIGINT

# Wait for either process to exit
wait -n

# If one exits, kill the other and exit with error
echo "A server process exited unexpectedly"
cleanup
exit 1
