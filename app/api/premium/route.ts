import { NextResponse } from "next/server";

/**
 * GET /api/premium - Check if current user has premium status
 * Proxies to the Elysia server which has the billing check logic
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/premium`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });

    if (!res.ok) {
      return NextResponse.json({ isPremium: false });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ isPremium: false });
  }
}
