/**
 * TTS Voices Proxy — fetches available voices from the Elysia server.
 * Response is user-specific (locked state depends on auth).
 */

import { headers } from "next/headers";

export const runtime = "nodejs";

const API_URL = process.env.INTERNAL_API_URL || "http://localhost:3001";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const fwdHeaders: Record<string, string> = {};
    const auth = reqHeaders.get("authorization");
    if (auth) fwdHeaders["Authorization"] = auth;
    const cookie = reqHeaders.get("cookie");
    if (cookie) fwdHeaders["Cookie"] = cookie;

    const response = await fetch(`${API_URL}/api/tts/voices`, {
      headers: fwdHeaders,
    });
    const data = await response.json();
    return Response.json(data, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return Response.json({ error: "Failed to fetch voices" }, { status: 503 });
  }
}
