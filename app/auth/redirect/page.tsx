import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClerkClient } from "@clerk/backend";

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
  const returnUrl = params.returnUrl || "/";

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
