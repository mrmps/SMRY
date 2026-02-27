/**
 * Chat Streaming Proxy
 *
 * Next.js Route Handler that proxies chat requests to the Elysia server
 * with proper streaming support. Next.js rewrites buffer SSE responses,
 * so this handler ensures the stream is forwarded without buffering.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.INTERNAL_API_URL || "http://localhost:3001";

export async function POST(req: Request) {
  const body = await req.text();

  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  // Forward auth header
  const auth = req.headers.get("Authorization");
  if (auth) {
    headers.set("Authorization", auth);
  }

  // Forward client IP for rate limiting
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    headers.set("x-forwarded-for", forwarded);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers,
      body,
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Chat service is temporarily unavailable" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  // Return the streaming response directly — no buffering
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      // Forward usage headers from Elysia (use !== null, not truthy — "0" is falsy)
      ...(response.headers.get("X-Usage-Remaining") !== null && {
        "X-Usage-Remaining": response.headers.get("X-Usage-Remaining")!,
      }),
      ...(response.headers.get("X-Usage-Limit") !== null && {
        "X-Usage-Limit": response.headers.get("X-Usage-Limit")!,
      }),
      ...(response.headers.get("X-Is-Premium") !== null && {
        "X-Is-Premium": response.headers.get("X-Is-Premium")!,
      }),
      ...(response.headers.get("X-Model") !== null && {
        "X-Model": response.headers.get("X-Model")!,
      }),
      // Preserve AI SDK stream header
      ...(response.headers.get("x-vercel-ai-ui-message-stream") !== null && {
        "x-vercel-ai-ui-message-stream": response.headers.get("x-vercel-ai-ui-message-stream")!,
      }),
    },
  });
}
