/**
 * TTS Streaming Proxy
 *
 * Next.js Route Handler that proxies TTS requests to the Elysia server
 * with proper SSE streaming support. Includes:
 * - 120s timeout (TTS synthesis can take time for long articles)
 * - Auth forwarding (Bearer token + session cookie)
 * - Client IP forwarding for rate limiting
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.INTERNAL_API_URL || "http://localhost:3001";

export async function POST(req: Request) {
  const body = await req.text();

  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  // Forward auth
  const auth = req.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);

  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  // Forward client IP for rate limiting
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) headers.set("x-forwarded-for", forwarded);

  const realIp = req.headers.get("x-real-ip");
  if (realIp) headers.set("x-real-ip", realIp);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/tts`, {
      method: "POST",
      headers,
      body,
      // 120s timeout — long articles take time to synthesize
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      return new Response(
        JSON.stringify({ error: "TTS synthesis timed out. Try a shorter article." }),
        { status: 504, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ error: "TTS service unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Forward the SSE stream with proper headers
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-TTS-Usage-Count": response.headers.get("X-TTS-Usage-Count") || "0",
      "X-TTS-Usage-Limit": response.headers.get("X-TTS-Usage-Limit") || "3",
    },
  });
}
