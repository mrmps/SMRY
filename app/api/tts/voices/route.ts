/**
 * TTS Voices Proxy — fetches available voices from the Elysia server.
 */

export const runtime = "nodejs";

const API_URL = process.env.INTERNAL_API_URL || "http://localhost:3001";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/tts/voices`);
    const data = await response.json();
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return Response.json({ error: "Failed to fetch voices" }, { status: 503 });
  }
}
