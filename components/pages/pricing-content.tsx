"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { CheckoutButton, useSubscription, SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import { Check, ChevronDown, ArrowLeft, Crown, CheckCircle } from "lucide-react";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getAndClearReturnUrl, storeReturnUrl } from "@/lib/hooks/use-return-url";

// Track buy button clicks
function trackBuyClick(plan: "monthly" | "annual", user?: { email?: string; name?: string }) {
  fetch("/api/webhooks/track/buy-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan,
      userEmail: user?.email,
      userName: user?.name,
      isSignedIn: !!user,
    }),
  }).catch(() => {
    // Silent fail - tracking shouldn't break the UI
  });
}

const testimonials = [
  {
    name: "Joyce",
    handle: "@Joyce_GCDE",
    avatar: "https://unavatar.io/twitter/Joyce_GCDE",
    text: "smry.ai is the best paywall remover I had ever used (Yeah I am too broke to pay for that much paywall)",
    url: "https://x.com/Joyce_GCDE/status/1968299170999242995",
  },
  {
    name: "Rombert",
    handle: "@Rombert59836",
    avatar: "https://unavatar.io/twitter/Rombert59836",
    text: "smry.ai works for most paywalls i like it :D",
    url: "https://x.com/Rombert59836/status/1932906877995938047",
  },
  {
    name: "abhi",
    handle: "@awwbhi2",
    avatar: "https://unavatar.io/twitter/awwbhi2",
    text: "smry.ai is super useful. Thank you!",
    url: "https://x.com/awwbhi2/status/1887041766878273990",
  },
  {
    name: "Golfers Club",
    handle: "@Golfersclubhe",
    avatar: "https://unavatar.io/twitter/Golfersclubhe",
    text: "This works pretty well smry.ai",
    url: "https://x.com/Golfersclubhe/status/1938677363492933786",
  },
];

type BillingPeriod = "monthly" | "annual";

// Clerk plan ID from dashboard (Configure → Plan ID)
const PATRON_PLAN_ID = "cplan_36Vi5qaiHA0417wdNSZjHSJrjxI";

const publications = [
  "Medium",
  "Business Insider",
  "Wired",
  "The Atlantic",
  "Foreign Policy",
  "Quora",
];

export function PricingContent() {
  const t = useTranslations("pricing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const { data: _subscription } = useSubscription();
  const { isPremium, isLoading: isPremiumLoading } = useIsPremium();
  const { user } = useUser();

  // Get return URL from query params or sessionStorage
  const returnUrlFromParams = searchParams.get("returnUrl");

  // Auto-hide success toast after 3 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // Redirect premium users back to their original page
  useEffect(() => {
    if (isPremium && !isPremiumLoading && user) {
      // Get return URL from params or sessionStorage
      const returnUrl = returnUrlFromParams || getAndClearReturnUrl();
      if (returnUrl && returnUrl !== "/" && returnUrl !== "/pricing") {
        // Small delay to let the success toast show if it's visible
        const timer = setTimeout(() => {
          router.push(returnUrl);
        }, showSuccess ? 1500 : 0);
        return () => clearTimeout(timer);
      }
    }
  }, [isPremium, isPremiumLoading, user, returnUrlFromParams, router, showSuccess]);

  // User info for tracking
  const userInfo = user ? {
    email: user.primaryEmailAddress?.emailAddress,
    name: user.firstName || undefined,
  } : undefined;

  // Derive user state for UI (only used within SignedIn blocks)
  const isProUser = isPremium && !isPremiumLoading;

  const monthlyPrice = 6;
  const annualPrice = 36;
  const originalAnnualPrice = 72;
  const annualMonthly = annualPrice / 12;

  const faqs = [
    { q: t("faqHowWorks"), a: t("faqHowWorksAnswer") },
    { q: t("faqPublications"), a: t("faqPublicationsAnswer") },
    { q: t("faqCancel"), a: t("faqCancelAnswer") },
    { q: t("faqTrial"), a: t("faqTrialAnswer") },
    { q: t("faqPayment"), a: t("faqPaymentAnswer") },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top fade-in duration-300">
          <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg">
            <CheckCircle className="size-5" />
            <span className="font-medium">Welcome to Pro! Redirecting...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-background">
        <div className="mx-auto flex flex-col items-center px-6 pt-6">
          <Link href="/" className="mb-2">
            <Image
              src="/logo.svg"
              width={80}
              height={28}
              alt="smry"
              className="dark:invert"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <ArrowLeft className="size-3.5" />
            <span>{t("backToSmry")}</span>
          </Link>
        </div>

        {/* User button in corner */}
        <div className="absolute top-4 right-4">
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "size-7",
                },
              }}
            />
          </SignedIn>
        </div>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center px-4 pt-12 pb-8">
        {/* Limited Time Banner */}
        <p className="mb-6 text-sm text-amber-700 dark:text-amber-300">
          <span className="font-semibold">Early supporter pricing</span>
          <span className="mx-1.5">·</span>
          <span>Ends February 15th</span>
        </p>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
          {t("readWithoutLimits")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground text-center max-w-md">
          {t("fullAccessFrom")}{" "}
          <span className="text-foreground font-medium">$0.08 {t("perDay")}</span> — {t("cancelAnytime")}.
        </p>
      </div>

      {/* Single Pro Card - Centered */}
      <div className="flex justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          {/* Pro Card */}
          <div className={`rounded-2xl border ${isProUser ? "border-amber-500/50" : "border-border"} bg-card p-6 relative`}>
            {/* Badge */}
            <div className="absolute -top-3 left-4">
              {isProUser ? (
                <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-semibold px-2 py-1 rounded-lg">
                  <Crown className="size-3" />
                  {t("currentPlan")}
                </span>
              ) : (
                <span className="bg-amber-400 text-amber-950 text-xs font-semibold px-2 py-1 rounded-lg">
                  {t("popular")}
                </span>
              )}
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold">{t("pro")}</h3>
              <p className="text-sm text-muted-foreground">{t("forPowerReaders")}</p>
            </div>

            {/* Price Display with Strikethrough */}
            <div className="mb-4">
              {billingPeriod === "annual" ? (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-red-500 line-through">${originalAnnualPrice}</span>
                  <span className="text-4xl font-bold">${annualPrice}</span>
                  <span className="bg-foreground text-background text-xs font-bold px-2 py-1 rounded">
                    Save 50%
                  </span>
                </div>
              ) : (
                <span className="text-4xl font-bold">${monthlyPrice}</span>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                {billingPeriod === "annual"
                  ? `billed yearly ($${annualMonthly}/month).`
                  : "billed monthly."
                }
              </p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setBillingPeriod("annual")}
                className="text-left"
                type="button"
              >
                <span className={`text-sm font-medium ${billingPeriod === "annual" ? "text-foreground" : "text-muted-foreground"}`}>
                  {t("yearly")}
                </span>
              </button>

              {/* Toggle Switch */}
              <button
                onClick={() => setBillingPeriod(billingPeriod === "annual" ? "monthly" : "annual")}
                className="relative w-[52px] h-[28px] rounded-full bg-muted flex-shrink-0"
                aria-label="Toggle billing period"
                type="button"
                role="switch"
                aria-checked={billingPeriod === "monthly"}
              >
                <span
                  className={`absolute top-[2px] left-[2px] w-[24px] h-[24px] rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                    billingPeriod === "monthly" ? "translate-x-[24px]" : "translate-x-0"
                  }`}
                />
              </button>

              <button
                onClick={() => setBillingPeriod("monthly")}
                className="text-right"
                type="button"
              >
                <span className={`text-sm font-medium ${billingPeriod === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>
                  {t("monthly")}
                </span>
                <span className="block text-xs text-muted-foreground">(${monthlyPrice}/month)</span>
              </button>
            </div>

            {/* Separator */}
            <div className="border-t border-border mb-4" />

            {/* CTA Button */}
            <SignedIn>
              {isProUser ? (
                <SubscriptionDetailsButton>
                  <button className="w-full py-3 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors">
                    {t("manageSubscription")}
                  </button>
                </SubscriptionDetailsButton>
              ) : (
                <div
                  className="checkout-btn-primary"
                  onClick={() => trackBuyClick(billingPeriod, userInfo)}
                >
                  <CheckoutButton
                    planId={PATRON_PLAN_ID}
                    planPeriod={billingPeriod === "annual" ? "annual" : "month"}
                    onSubscriptionComplete={() => setShowSuccess(true)}
                  >
                    Start free for 7 days
                  </CheckoutButton>
                </div>
              )}
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal" fallbackRedirectUrl="/pricing">
                <button
                  onClick={() => storeReturnUrl(returnUrlFromParams || undefined)}
                  className="w-full py-3 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors"
                >
                  Start free for 7 days
                </button>
              </SignInButton>
            </SignedOut>

            {/* Reassurance text */}
            <p className="mt-3 text-xs text-muted-foreground text-center leading-relaxed">
              No payment due now
              <br />
              Cancel anytime
            </p>

            {/* Feature List - Reordered */}
            <ul className="mt-6 space-y-3">
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>1000+ publications unlocked</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("adFreeReading")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("unlimitedArticles")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("unlimitedAiSummaries")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("premiumAiModels")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("unlimitedHistory")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("searchAllPastArticles")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("bypassIndicator")}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Publications + Cost Comparison */}
      <div className="relative py-20 overflow-hidden border-t border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/50 via-background to-background" />

        <div className="relative max-w-4xl mx-auto px-4">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-4">
            {t("worksWith")}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-20">
            {publications.map((pub) => (
              <span
                key={pub}
                className="px-4 py-2 rounded-full bg-card border border-border text-sm font-medium text-foreground/80 hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                {pub}
              </span>
            ))}
          </div>

          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">{t("saveVsSubscriptions")}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-xs text-muted-foreground mb-3">Individual subscriptions</p>
                <p className="text-2xl font-bold text-muted-foreground">$100+<span className="text-sm font-normal">/mo</span></p>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    NYT $17 + WSJ $20 + Bloomberg $35 + more...
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-foreground text-background p-4 relative">
                <div className="absolute -top-2 -right-2">
                  <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    SAVE 97%
                  </span>
                </div>
                <p className="text-xs text-background/70 mb-3">smry Pro</p>
                <p className="text-2xl font-bold">${billingPeriod === "annual" ? annualMonthly : monthlyPrice}<span className="text-sm font-normal">/mo</span></p>
                <div className="mt-3 pt-3 border-t border-background/20">
                  <p className="text-xs text-background/70 leading-relaxed">
                    All publications, one price
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="py-20 px-4 border-t border-border bg-accent/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              260,000+ {t("activeUsers")}
            </p>
            <h2 className="text-2xl font-bold tracking-tight">{t("lovedByReaders")}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {testimonials.map((item) => (
              <a
                key={item.handle}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-border bg-card p-5 hover:border-foreground/20 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Image
                    src={item.avatar}
                    alt={item.name}
                    width={40}
                    height={40}
                    className="size-10 rounded-full bg-muted object-cover"
                  />
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.handle}</p>
                  </div>
                  <svg className="size-4 ml-auto text-muted-foreground" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{item.text}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="py-16 px-4 border-t border-border">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{t("faqTitle")}</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-4 px-4 text-left hover:bg-accent/50 transition-colors"
                >
                  <span className="text-sm font-medium">{faq.q}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 text-muted-foreground transition-transform motion-reduce:transition-none ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-12 px-4 border-t border-border bg-accent/30">
        <div className="max-w-md mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {t("stillHaveQuestions")}{" "}
            <a
              href="https://x.com/michael_chomsky"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
            >
              {t("reachOut")}
            </a>
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>{t("freeTrial")}</span>
            <span>•</span>
            <span>{t("cancelAnytime")}</span>
            <span>•</span>
            <span>{t("noQuestions")}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
