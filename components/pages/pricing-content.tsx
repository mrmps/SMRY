"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { CheckoutButton, SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import { Check, ChevronDown, ArrowLeft, CheckCircle, X } from "lucide-react";
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

const _publications = [
  "Medium",
  "Business Insider",
  "Wired",
  "The Atlantic",
  "Foreign Policy",
  "Quora",
  "Bloomberg",
  "The New Yorker",
  "MIT Tech Review",
];

const publicationCategories = [
  { label: "News", pubs: ["NYT", "WSJ", "WaPo", "Bloomberg"] },
  { label: "Tech", pubs: ["Wired", "MIT Tech", "The Verge", "Ars Technica"] },
  { label: "Business", pubs: ["HBR", "Forbes", "Inc.", "Fast Company"] },
  { label: "Culture", pubs: ["The Atlantic", "New Yorker", "Vanity Fair"] },
];

interface CTAButtonProps {
  variant: "desktop" | "mobile";
  hasMounted: boolean;
  isProUser: boolean;
  billingPeriod: BillingPeriod;
  manageSubscriptionLabel: string;
  onCheckoutOpen: () => void;
  onSubscriptionComplete: () => void;
  onSignedOutClick?: () => void;
}

function CTAButton({
  variant,
  hasMounted,
  isProUser,
  billingPeriod,
  manageSubscriptionLabel,
  onCheckoutOpen,
  onSubscriptionComplete,
  onSignedOutClick,
}: CTAButtonProps) {
  const baseStyles = variant === "desktop"
    ? "w-full py-2.5 px-4 rounded-lg bg-foreground text-background font-medium text-sm"
    : "w-full py-3 px-4 rounded-lg bg-foreground text-background font-medium text-sm";

  const interactiveStyles = "hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none";

  const ctaText = "Start My Free Trial";

  const loadingButton = (
    <button className={baseStyles} aria-disabled="true" disabled>
      {ctaText}
    </button>
  );

  if (!hasMounted) {
    return loadingButton;
  }

  return (
    <>
      <ClerkLoading>{loadingButton}</ClerkLoading>
      <ClerkLoaded>
        <SignedIn>
          {isProUser ? (
            <SubscriptionDetailsButton>
              <button className={`${baseStyles} ${interactiveStyles}`}>
                {manageSubscriptionLabel}
              </button>
            </SubscriptionDetailsButton>
          ) : (
            <div className="checkout-btn-primary">
              <CheckoutButton
                planId={process.env.NEXT_PUBLIC_CLERK_PATRON_PLAN_ID!}
                planPeriod={billingPeriod === "annual" ? "annual" : "month"}
                onSubscriptionComplete={onSubscriptionComplete}
              >
                <button type="button" onClick={onCheckoutOpen}>
                  {ctaText}
                </button>
              </CheckoutButton>
            </div>
          )}
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal" fallbackRedirectUrl="/pricing">
            <button
              onClick={onSignedOutClick}
              className={`${baseStyles} ${interactiveStyles}`}
            >
              {ctaText}
            </button>
          </SignInButton>
        </SignedOut>
      </ClerkLoaded>
    </>
  );
}

export function PricingContent() {
  const t = useTranslations("pricing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const { isPremium, isLoading: isPremiumLoading } = useIsPremium();
  const { user } = useUser();

  // Get return URL from query params or sessionStorage
  const returnUrlFromParams = searchParams.get("returnUrl");

  // Check if user came from an article (for showing dismiss option)
  // Use state to avoid hydration mismatch from sessionStorage access
  const [hasStoredReturnUrl, setHasStoredReturnUrl] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: hydration-safe sessionStorage access
    setHasStoredReturnUrl(!!sessionStorage.getItem("smry-return-url"));
  }, []);
  const hasReturnUrl = !!(returnUrlFromParams || hasStoredReturnUrl);

  // Handle dismiss/go back
  const handleDismiss = useCallback(() => {
    const returnUrl = returnUrlFromParams || getAndClearReturnUrl();
    if (returnUrl && returnUrl !== "/" && returnUrl !== "/pricing") {
      router.push(returnUrl);
    } else {
      router.push("/");
    }
  }, [returnUrlFromParams, router]);

  // Track when component has mounted for hydration-safe rendering
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: standard hasMounted pattern for SSR
    setHasMounted(true);
  }, []);

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
  const userInfo = useMemo(() => {
    return user
      ? {
          email: user.primaryEmailAddress?.emailAddress,
          name: user.firstName || undefined,
        }
      : undefined;
  }, [user]);

  const handleCheckoutOpen = useCallback((plan: BillingPeriod) => {
    trackBuyClick(plan, userInfo);
  }, [userInfo]);

  // Derive user state for UI (only used within SignedIn blocks)
  const isProUser = isPremium && !isPremiumLoading;

  const monthlyPrice = 6;
  const annualPrice = 36;
  const originalAnnualPrice = 72;
  const annualMonthly = annualPrice / 12;

  // Countdown timer to Feb 15 (currently unused - keeping for future use)
  const _timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const deadline = new Date("2025-02-15T23:59:59");
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff > 0) {
        // Timer values available but not currently displayed
        const _days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const _hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const _minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        void [_days, _hours, _minutes]; // Suppress unused warnings
      }
    };

    calculateTimeLeft();
    _timerRef.current = setInterval(calculateTimeLeft, 60000);
    return () => {
      if (_timerRef.current) clearInterval(_timerRef.current);
    };
  }, []);

  const faqs = [
    { q: t("faqHowWorks"), a: t("faqHowWorksAnswer") },
    { q: t("faqPublications"), a: t("faqPublicationsAnswer") },
    { q: "What if it doesn't work for my favorite site?", a: "Our bypass detection instantly tells you if an article was fully retrieved. If a site isn't working, you can request it and we'll prioritize adding support. With 1,000+ publications already supported, most major sites work great." },
    { q: t("faqCancel"), a: t("faqCancelAnswer") },
    { q: t("faqTrial"), a: t("faqTrialAnswer") },
    { q: "Is this legal?", a: "Yes. smry works by accessing publicly available content through various legal methods. We don't store or redistribute copyrighted content — we simply help you read articles you've found." },
    { q: t("faqPayment"), a: t("faqPaymentAnswer") },
    { q: "Why should I pay when there are free alternatives?", a: "Free tools are often slow, unreliable, or filled with ads. smry Pro gives you instant access, premium AI summaries, bypass detection, and a clean reading experience. At $3/month, it pays for itself with a single article from any major publication." },
  ];

  return (
    // isolation: isolate creates a stacking context boundary so Clerk modals appear above all app content
    <div className="isolate">
      {/* Success Toast - outside main for z-index */}
      {showSuccess && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-top fade-in duration-300 motion-reduce:animate-none"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 bg-success text-success-foreground px-4 py-3 rounded-lg shadow-lg">
            <CheckCircle className="size-5" aria-hidden="true" />
            <span className="font-medium">Welcome to Pro! Redirecting…</span>
          </div>
        </div>
      )}

      <main className="flex min-h-dvh flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background">
          <div className="mx-auto flex items-center justify-between px-4 py-3 sm:px-6">
            {/* Left: Back/Dismiss */}
            <button
              onClick={handleDismiss}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none touch-action-manipulation"
              aria-label="Go back"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("backToSmry")}</span>
            </button>

            {/* Center: Logo */}
            <Link href="/" className="absolute left-1/2 -translate-x-1/2">
              <Image
                src="/logo.svg"
                width={64}
                height={22}
                alt="smry"
                className="dark:invert"
              />
            </Link>

            {/* Right: User button or dismiss */}
            <div className="flex items-center gap-2">
              <SignedIn>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "size-7",
                    },
                  }}
                />
              </SignedIn>
              <SignedOut>
                {hasReturnUrl && (
                  <button
                    onClick={handleDismiss}
                    className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none touch-action-manipulation"
                    aria-label="Close and continue with free plan"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                )}
              </SignedOut>
            </div>
          </div>
        </header>

        {/* Hero */}
        <div className="flex flex-col items-center px-4 pt-6 sm:pt-10">
          <h1 className="text-[1.75rem] sm:text-[2.25rem] font-semibold tracking-[-0.035em] text-center leading-[1.15]">
            {t("readWithoutLimits")}
          </h1>
          <p className="mt-2 text-[14px] sm:text-[15px] text-muted-foreground text-center max-w-[320px] leading-[1.55]">
            Skip the $100+/month in subscriptions.{" "}
            <span className="text-foreground">Get everything for $3/month</span>.
          </p>
        </div>

        {/* Card */}
        <div className="flex justify-center px-4 pt-5 pb-24 sm:pb-16">
          <div className="w-full max-w-[320px]">
            <div className={`rounded-xl border ${isProUser ? "border-[var(--p3-gold)]/20" : "border-foreground/[0.06]"} bg-card px-5 py-6`}>

              {/* Urgency - subtle */}
              {billingPeriod === "annual" && !isProUser && (
                <p className="text-[11px] text-center text-[var(--p3-emerald)] mb-4 font-medium">
                  Limited time · 50% off
                </p>
              )}

              {/* Price */}
              <div className="text-center">
                <div className="flex items-baseline justify-center gap-1">
                  {billingPeriod === "annual" && (
                    <span className="text-base text-muted-foreground/35 line-through tabular-nums">${originalAnnualPrice}</span>
                  )}
                  <span className="text-[2.75rem] font-semibold tabular-nums tracking-[-0.03em] leading-none">
                    ${billingPeriod === "annual" ? annualPrice : monthlyPrice}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {billingPeriod === "annual"
                    ? <><span className="text-foreground/90">${annualMonthly}/mo</span> · billed yearly</>
                    : "per month"
                  }
                </p>
              </div>

              {/* Billing Toggle */}
              <fieldset className="mt-5 mb-4">
                <legend className="sr-only">Billing period</legend>
                <div className="flex p-0.5 bg-muted/40 rounded-lg">
                  <button
                    onClick={() => setBillingPeriod("annual")}
                    className={`flex-1 py-[7px] rounded-[6px] text-[13px] font-medium transition-colors ${
                      billingPeriod === "annual"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                    aria-pressed={billingPeriod === "annual"}
                  >
                    {t("yearly")}
                  </button>
                  <button
                    onClick={() => setBillingPeriod("monthly")}
                    className={`flex-1 py-[7px] rounded-[6px] text-[13px] font-medium transition-colors ${
                      billingPeriod === "monthly"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                    aria-pressed={billingPeriod === "monthly"}
                  >
                    {t("monthly")}
                  </button>
                </div>
              </fieldset>

              {/* CTA */}
              <CTAButton
                variant="desktop"
                hasMounted={hasMounted}
                isProUser={isProUser}
                billingPeriod={billingPeriod}
                manageSubscriptionLabel={t("manageSubscription")}
                onCheckoutOpen={() => handleCheckoutOpen(billingPeriod)}
                onSubscriptionComplete={() => setShowSuccess(true)}
                onSignedOutClick={() => storeReturnUrl(returnUrlFromParams || undefined)}
              />

              <p className="mt-2.5 text-[10px] text-muted-foreground/50 text-center tracking-wide">
                7-day free trial · Cancel anytime
              </p>

              {/* Features */}
              <div className="mt-5 pt-4 border-t border-foreground/[0.04]">
                <ul className="space-y-2" aria-label="Pro features">
                  <li className="flex items-center gap-2 text-[12px] text-foreground/75">
                    <Check className="size-3 shrink-0 text-[var(--p3-emerald)]" aria-hidden="true" />
                    1,000+ publications
                  </li>
                  <li className="flex items-center gap-2 text-[12px] text-foreground/75">
                    <Check className="size-3 shrink-0 text-[var(--p3-emerald)]" aria-hidden="true" />
                    {t("unlimitedArticles")}
                  </li>
                  <li className="flex items-center gap-2 text-[12px] text-foreground/75">
                    <Check className="size-3 shrink-0 text-[var(--p3-emerald)]" aria-hidden="true" />
                    AI summaries
                  </li>
                  <li className="flex items-center gap-2 text-[12px] text-foreground/75">
                    <Check className="size-3 shrink-0 text-[var(--p3-emerald)]" aria-hidden="true" />
                    {t("adFreeReading")}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Free vs Pro Comparison */}
        <div className="py-10 sm:py-14 px-4 border-t border-border bg-accent/20">
          <div className="max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-bold text-center mb-6">
              Free vs Pro
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-3 text-center text-xs font-medium border-b border-border">
                <div className="p-3 text-muted-foreground">Feature</div>
                <div className="p-3 border-x border-border text-muted-foreground">Free</div>
                <div className="p-3 bg-foreground/5 text-foreground">Pro</div>
              </div>
              {[
                { feature: "Articles per day", free: "3", pro: "Unlimited" },
                { feature: "AI summaries", free: "Basic", pro: "Premium" },
                { feature: "Bypass detection", free: "—", pro: <Check className="size-4 text-success mx-auto" /> },
                { feature: "Ad-free reading", free: "—", pro: <Check className="size-4 text-success mx-auto" /> },
                { feature: "Search history", free: "—", pro: <Check className="size-4 text-success mx-auto" /> },
                { feature: "Priority support", free: "—", pro: <Check className="size-4 text-success mx-auto" /> },
              ].map((row, i) => (
                <div key={i} className={`grid grid-cols-3 text-center text-sm ${i !== 5 ? "border-b border-border" : ""}`}>
                  <div className="p-3 text-left text-muted-foreground text-xs">{row.feature}</div>
                  <div className="p-3 border-x border-border text-muted-foreground text-xs">{row.free}</div>
                  <div className="p-3 bg-foreground/5 font-medium text-xs">{row.pro}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How it Works - Simple 3 steps */}
        <div className="py-10 sm:py-16 px-4 border-t border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-lg sm:text-xl font-bold text-center mb-8 sm:mb-10">
              Start reading in 3 simple steps
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
              {[
                {
                  step: "1",
                  title: "Start free trial",
                  desc: "No credit card required for 7 days",
                  icon: (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  ),
                },
                {
                  step: "2",
                  title: "Paste any article URL",
                  desc: "Works with 1,000+ publications",
                  icon: (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  ),
                },
                {
                  step: "3",
                  title: "Read the full article",
                  desc: "Instant access, no paywall",
                  icon: (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  ),
                },
              ].map((item, i) => (
                <div key={i} className="flex sm:flex-col items-start sm:items-center gap-4 sm:gap-3 text-left sm:text-center">
                  <div className="flex items-center justify-center size-12 rounded-2xl bg-accent text-foreground shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-0.5">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Publications + Cost Comparison */}
        <div className="relative py-12 sm:py-20 overflow-hidden border-t border-border">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/50 via-background to-background" aria-hidden="true" />

          <div className="relative max-w-4xl mx-auto px-4">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("worksWith")}
            </p>
            <p className="text-center text-2xl sm:text-3xl font-bold mb-6">
              1,000+ publications
            </p>

            {/* Publication categories */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12 sm:mb-20">
              {publicationCategories.map((cat) => (
                <div key={cat.label} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat.label}</p>
                  <div className="space-y-1">
                    {cat.pubs.map((pub) => (
                      <p key={pub} className="text-xs sm:text-sm text-foreground/80">{pub}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Value Calculator */}
            <div className="max-w-md mx-auto">
              <div className="rounded-2xl border-2 border-border bg-card p-6 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute -top-12 -right-12 size-24 bg-success/5 rounded-full blur-2xl" aria-hidden="true" />

                <h3 className="text-center font-semibold mb-4">Your savings calculator</h3>

                {/* Cost breakdown */}
                <div className="space-y-2 mb-4">
                  {[
                    { name: "New York Times", price: "$17" },
                    { name: "Wall Street Journal", price: "$20" },
                    { name: "The Atlantic", price: "$10" },
                    { name: "Bloomberg", price: "$35" },
                    { name: "Washington Post", price: "$10" },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium text-price-strike line-through opacity-60">{item.price}/mo</span>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-border my-4" />

                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Typical monthly cost</span>
                  <span className="font-bold text-price-strike line-through">$92/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">smry Pro</span>
                  <span className="text-2xl font-bold text-success">
                    ${billingPeriod === "annual" ? annualMonthly : monthlyPrice}/mo
                  </span>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-success/10 text-center">
                  <p className="text-sm font-semibold text-success">
                    You save ${92 - (billingPeriod === "annual" ? annualMonthly : monthlyPrice)}/month
                  </p>
                  <p className="text-xs text-success/80 mt-0.5">
                    That&apos;s ${(92 - (billingPeriod === "annual" ? annualMonthly : monthlyPrice)) * 12}/year back in your pocket
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Perfect For - Personas */}
        <div className="py-10 sm:py-14 px-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg sm:text-xl font-bold text-center mb-2">
              Perfect for
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Readers who want more without paying more
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { emoji: "📰", label: "News junkies", desc: "Stay informed daily" },
                { emoji: "🎓", label: "Researchers", desc: "Access academic sources" },
                { emoji: "💼", label: "Professionals", desc: "Industry insights" },
                { emoji: "📚", label: "Curious minds", desc: "Explore any topic" },
              ].map((persona, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 text-center hover:border-foreground/20 transition-colors">
                  <span className="text-2xl mb-2 block" role="img" aria-label={persona.label}>{persona.emoji}</span>
                  <p className="font-medium text-sm">{persona.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{persona.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Social Proof */}
        <div className="py-12 sm:py-20 px-4 border-t border-border bg-accent/30">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              {/* Star rating */}
              <div className="flex items-center justify-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} className="size-5 text-amber-400 fill-current" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <span className="ml-2 text-sm font-medium text-foreground">4.9/5</span>
              </div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                Trusted by 260,000+ readers worldwide
              </p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-pretty">{t("lovedByReaders")}</h2>
            </div>

            {/* Featured metric */}
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-2xl bg-card border border-foreground/10 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-3xl sm:text-4xl font-bold text-foreground mb-1">$89+</p>
                  <p className="text-sm text-muted-foreground">Average monthly savings per user</p>
                </div>
                <div className="hidden sm:block w-px h-12 bg-border" />
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-3xl sm:text-4xl font-bold text-foreground mb-1">2.4M</p>
                  <p className="text-sm text-muted-foreground">Articles read this month</p>
                </div>
                <div className="hidden sm:block w-px h-12 bg-border" />
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-3xl sm:text-4xl font-bold text-foreground mb-1">98%</p>
                  <p className="text-sm text-muted-foreground">Success rate on major sites</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {testimonials.map((item, index) => (
                <a
                  key={item.handle}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group rounded-xl border bg-card p-4 sm:p-5 hover:border-foreground/20 transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    index === 0 ? "border-foreground/20 shadow-sm" : "border-border"
                  }`}
                >
                  {/* Quote mark */}
                  <svg className="size-6 text-muted-foreground/30 mb-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/>
                  </svg>
                  <p className="text-sm text-foreground/90 leading-relaxed mb-3">{item.text}</p>
                  <div className="flex items-center gap-3">
                    <Image
                      src={item.avatar}
                      alt=""
                      width={40}
                      height={40}
                      className="size-9 sm:size-10 rounded-full bg-muted object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.handle}</p>
                    </div>
                    <svg className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>

            {/* Payment methods trust badges */}
            <div className="mt-10 sm:mt-12 text-center">
              <p className="text-xs text-muted-foreground mb-3">Secure payment powered by Stripe</p>
              <div className="flex items-center justify-center gap-3 opacity-60">
                <svg className="h-6" viewBox="0 0 38 24" fill="currentColor" aria-label="Visa">
                  <path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="currentColor" opacity="0.07"/>
                  <path d="M35 1c1.1 0 2 .9 2 2v18c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2h32" fill="currentColor" opacity="0.1"/>
                  <path d="M28.3 10.1H28c-.4 1-.7 1.5-1 3h1.9c-.3-1.5-.3-2.2-.6-3zm2.9 5.9h-1.7c-.1 0-.1 0-.2-.1l-.2-.9-.1-.2h-2.4c-.1 0-.2 0-.2.2l-.3.9c0 .1-.1.1-.1.1h-2.1l.2-.5L27 8.7c0-.5.3-.7.8-.7h1.5c.1 0 .2 0 .2.2l1.4 6.5c.1.4.2.7.2 1.1.1.1.1.1 0 .2zm-13.4-.3l.4-1.8c.1 0 .2.1.2.1.7.3 1.4.5 2.1.4.2 0 .5-.1.7-.2.5-.2.5-.7.1-1.1-.2-.2-.5-.3-.8-.5-.4-.2-.8-.4-1.1-.7-1.2-1-.8-2.4-.1-3.1.6-.4.9-.8 1.7-.8 1.2 0 2.5 0 3.1.2h.1c-.1.6-.2 1.1-.4 1.7-.5-.2-1-.4-1.5-.4-.3 0-.6 0-.9.1-.2 0-.3.1-.4.2-.2.2-.2.5 0 .7l.5.4c.4.2.8.4 1.1.6.5.3 1 .8 1.1 1.4.2.9-.1 1.7-.9 2.3-.5.4-.7.6-1.4.6-1.4 0-2.5.1-3.4-.2-.1.2-.1.2-.2.1zm-3.5.3c.1-.7.1-.7.2-1 .5-2.2 1-4.5 1.4-6.7.1-.2.1-.3.3-.3H18c-.2 1.2-.4 2.1-.7 3.2-.3 1.5-.6 3-1 4.5 0 .2-.1.2-.3.2M5 8.2c0-.1.2-.2.3-.2h3.4c.5 0 .9.3 1 .8l.9 4.4c0 .1 0 .1.1.2 0-.1.1-.1.1-.1l2.1-5.1c-.1-.1 0-.2.1-.2h2.1c0 .1 0 .1-.1.2l-3.1 7.3c-.1.2-.1.3-.2.4-.1.1-.3 0-.5 0H9.7c-.1 0-.2 0-.2-.2L7.9 9.5c-.2-.2-.5-.5-.9-.6-.6-.3-1.7-.5-1.9-.5L5 8.2z" fill="currentColor"/>
                </svg>
                <svg className="h-6" viewBox="0 0 38 24" fill="currentColor" aria-label="Mastercard">
                  <path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="currentColor" opacity="0.07"/>
                  <path d="M35 1c1.1 0 2 .9 2 2v18c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2h32" fill="currentColor" opacity="0.1"/>
                  <circle fill="currentColor" opacity="0.6" cx="15" cy="12" r="7"/>
                  <circle fill="currentColor" opacity="0.6" cx="23" cy="12" r="7"/>
                </svg>
                <svg className="h-6" viewBox="0 0 38 24" fill="currentColor" aria-label="Apple Pay">
                  <path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="currentColor" opacity="0.07"/>
                  <path d="M35 1c1.1 0 2 .9 2 2v18c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2h32" fill="currentColor" opacity="0.1"/>
                  <path d="M12 12.25c0-1.2.5-2.25 1.34-3A3.84 3.84 0 0010.5 8c-1.3 0-2.4.75-3 .75-.65 0-1.65-.73-2.7-.71A4.02 4.02 0 001.5 10.3c-1.45 2.5-.37 6.2 1.02 8.23.7 1 1.5 2.1 2.55 2.06 1.03-.04 1.42-.65 2.66-.65 1.24 0 1.6.65 2.68.63 1.1-.02 1.8-1 2.48-2 .78-1.13 1.1-2.23 1.12-2.29-.03-.01-2.15-.82-2.17-3.25v-.01l.16.43zm-2.02-5.97c.54-.68.92-1.6.82-2.53-.8.03-1.77.53-2.34 1.2-.51.6-.96 1.55-.84 2.46.9.07 1.82-.44 2.36-1.13z" fill="currentColor"/>
                  <path d="M21.5 17.87h-1.24l-1.36-4.22h-.04l-1.36 4.22H16.3L14.5 11h1.2l1.2 4.52h.04l1.36-4.52h1.16l1.36 4.52h.04l1.2-4.52h1.18l-1.74 6.87z" fill="currentColor"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Reversal Guarantee */}
        <div className="py-10 sm:py-14 px-4 border-t border-border bg-success/5">
          <div className="max-w-md mx-auto text-center">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-success/10 mb-4">
              <svg className="size-7 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mb-2">
              100% Risk-Free Guarantee
            </h2>
            <p className="text-sm text-muted-foreground mb-4 text-pretty">
              Try Pro free for 7 days. If you&apos;re not completely satisfied within 30 days of subscribing,
              we&apos;ll refund your payment — no questions asked.
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" />
                7-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" />
                30-day refund
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" />
                Cancel anytime
              </span>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="py-12 sm:py-16 px-4 border-t border-border">
          <div className="max-w-xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8 text-pretty">{t("faqTitle")}</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden">
                  <button
                    id={`faq-question-${i}`}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenFaq(openFaq === i ? null : i);
                      }
                    }}
                    className="w-full flex items-center justify-between py-3.5 sm:py-4 px-4 text-left hover:bg-accent/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
                    aria-expanded={openFaq === i}
                    aria-controls={`faq-answer-${i}`}
                  >
                    <span className="text-sm font-medium pr-4">{faq.q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    id={`faq-answer-${i}`}
                    className={`overflow-hidden transition-all duration-200 motion-reduce:transition-none ${
                      openFaq === i ? "max-h-96" : "max-h-0"
                    }`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                  >
                    <div className="px-4 pb-4">
                      <p className="text-sm text-muted-foreground">{faq.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Final CTA Section */}
        <div className="py-12 sm:py-16 px-4 border-t border-border bg-gradient-to-b from-accent/50 to-background pb-32 sm:pb-16">
          <div className="max-w-lg mx-auto text-center">
            {/* Compelling closing statement */}
            <h2 className="text-xl sm:text-2xl font-bold mb-3 text-pretty">
              Start reading without limits today
            </h2>
            <p className="text-muted-foreground mb-6 text-pretty">
              Join 260,000+ readers who save $100+/month on news subscriptions
            </p>

            {/* Desktop final CTA */}
            <div className="hidden sm:block max-w-xs mx-auto">
              <CTAButton
                variant="desktop"
                hasMounted={hasMounted}
                isProUser={isProUser}
                billingPeriod={billingPeriod}
                manageSubscriptionLabel={t("manageSubscription")}
                onCheckoutOpen={() => handleCheckoutOpen(billingPeriod)}
                onSubscriptionComplete={() => setShowSuccess(true)}
                onSignedOutClick={() => storeReturnUrl(returnUrlFromParams || undefined)}
              />
            </div>

            {/* Trust reminder */}
            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                {t("freeTrial")}
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                {t("cancelAnytime")}
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                30-day guarantee
              </span>
            </div>

            {/* Contact for questions */}
            <p className="mt-8 text-sm text-muted-foreground">
              {t("stillHaveQuestions")}{" "}
              <a
                href="https://x.com/michael_chomsky"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded font-medium"
              >
                {t("reachOut")}
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-background border-t border-foreground/[0.05] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-semibold tabular-nums tracking-tight">
              ${billingPeriod === "annual" ? annualMonthly : monthlyPrice}/mo
            </span>
            {billingPeriod === "annual" && (
              <span className="text-[10px] text-[var(--p3-emerald)] font-medium">50% off</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/60">7-day free trial</span>
        </div>
        <CTAButton
          variant="mobile"
          hasMounted={hasMounted}
          isProUser={isProUser}
          billingPeriod={billingPeriod}
          manageSubscriptionLabel={t("manageSubscription")}
          onCheckoutOpen={() => handleCheckoutOpen(billingPeriod)}
          onSubscriptionComplete={() => setShowSuccess(true)}
          onSignedOutClick={() => storeReturnUrl(returnUrlFromParams || undefined)}
        />
      </div>
    </div>
  );
}
