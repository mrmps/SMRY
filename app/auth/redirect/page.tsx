import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClerkClient } from "@clerk/backend";

/**
 * Validate that a URL is a safe relative path to prevent open redirect attacks.
 * Rejects absolute URLs, protocol-relative URLs, and URLs with protocol schemes.
 */
function isValidReturnUrl(url: string): boolean {
  // Must start with / (relative path)
  if (!url.startsWith("/")) return false;
  // Must not be a protocol-relative URL (//evil.com)
  if (url.startsWith("//")) return false;
  // Must not contain protocol scheme in path (javascript:, data:, etc.)
  // Only check path portion, not query string (which may contain colons like timestamps)
  const [path] = url.split("?");
  if (path.includes(":")) return false;
  return true;
}

/**
 * Server-side auth redirect handler.
 *
 * After sign-in, Clerk redirects here. This page:
 * 1. Checks if user is premium (server-side, no client JS needed)
 * 2. Redirects premium users to their return URL
 * 3. Redirects non-premium users to /pricing
 *
 * This avoids the "flash" of showing pricing page to premium users.
 */
export default async function AuthRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const { userId } = await auth();
  const params = await searchParams;
  // Validate returnUrl to prevent open redirect attacks
  const rawReturnUrl = params.returnUrl || "/";
  const returnUrl = isValidReturnUrl(rawReturnUrl) ? rawReturnUrl : "/";

  // Not signed in - shouldn't happen but handle gracefully
  if (!userId) {
    redirect("/");
  }

  // Check premium status server-side
  const isPremium = await checkPremiumStatus(userId);

  if (isPremium) {
    // Premium users go back to where they came from
    redirect(returnUrl);
  } else {
    // Non-premium users go to pricing (with return URL preserved)
    const pricingUrl = returnUrl && returnUrl !== "/" && returnUrl !== "/pricing"
      ? `/pricing?returnUrl=${encodeURIComponent(returnUrl)}`
      : "/pricing";
    redirect(pricingUrl);
  }
}

/**
 * Check if user has active premium subscription via Clerk Billing API.
 * This runs server-side with no caching since it's a one-time redirect check.
 */
async function checkPremiumStatus(userId: string): Promise<boolean> {
  try {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!
    });

    const subscription = await clerk.billing.getUserBillingSubscription(userId);

    return subscription.subscriptionItems?.some(
      item => item.plan?.slug === "premium" && item.status === "active"
    ) ?? false;
  } catch {
    // No subscription or error = not premium
    return false;
  }
}
