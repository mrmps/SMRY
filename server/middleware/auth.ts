/**
 * Auth Middleware - Clerk JWT verification
 */

import { verifyToken } from "@clerk/backend";

interface AuthInfo {
  isPremium: boolean;
  userId: string | null;
}

export async function getAuthInfo(request: Request): Promise<AuthInfo> {
  try {
    const authHeader = request.headers.get("authorization");
    const cookieHeader = request.headers.get("cookie");

    let token: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (cookieHeader) {
      const match = cookieHeader.match(/__session=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) return { isPremium: false, userId: null };

    const result = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!result) return { isPremium: false, userId: null };

    const claims = result as Record<string, unknown>;
    const metadata = claims.public_metadata as Record<string, unknown> | undefined;
    const isPremium = metadata?.plan === "premium";
    const userId = (claims.sub as string) || null;

    return { isPremium, userId };
  } catch {
    return { isPremium: false, userId: null };
  }
}
