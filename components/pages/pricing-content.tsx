"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { CheckoutButton, SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import { Check, ChevronDown, ArrowLeft, Crown, CheckCircle, X } from "lucide-react";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getAndClearReturnUrl, storeReturnUrl } from "@/lib/hooks/use-return-url";
import { env } from "@/lib/env";

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

const publications = [
  "Medium",
  "Business Insider",
  "Wired",
  "The Atlantic",
  "Foreign Policy",
  "Quora",
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
    ? "w-full py-3 px-4 rounded-lg bg-foreground text-background font-medium text-sm"
    : "w-full py-3.5 px-4 rounded-xl bg-foreground text-background font-medium text-sm";

  const interactiveStyles = variant === "desktop"
    ? "hover:bg-foreground/90 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    : "";

  const loadingButton = (
    <button className={baseStyles} aria-disabled="true" disabled>
      Start Free for 7 Days
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
                planId={env.NEXT_PUBLIC_CLERK_PATRON_PLAN_ID}
                planPeriod={billingPeriod === "annual" ? "annual" : "month"}
                onSubscriptionComplete={onSubscriptionComplete}
              >
                <button type="button" onClick={onCheckoutOpen}>
                  Start Free for 7 Days
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
              Start Free for 7 Days
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

  const faqs = [
    { q: t("faqHowWorks"), a: t("faqHowWorksAnswer") },
    { q: t("faqPublications"), a: t("faqPublicationsAnswer") },
    { q: t("faqCancel"), a: t("faqCancelAnswer") },
    { q: t("faqTrial"), a: t("faqTrialAnswer") },
    { q: t("faqPayment"), a: t("faqPaymentAnswer") },
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
          <div className="mx-auto flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
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

        {/* Hero - Compact on mobile */}
        <div className="flex flex-col items-center px-4 pt-6 pb-4 sm:pt-12 sm:pb-8">
          {/* Limited Time Banner */}
          <p className="mb-4 sm:mb-6 text-sm text-promo">
            <span className="font-semibold">Early supporter pricing</span>
            <span className="mx-1.5">·</span>
            <span>Ends February&nbsp;15th</span>
          </p>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center text-pretty">
            {t("readWithoutLimits")}
          </h1>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-muted-foreground text-center max-w-md text-pretty">
            {t("fullAccessFrom")}{" "}
            <span className="text-foreground font-medium">$3/month</span> — {t("cancelAnytime")}.
          </p>
        </div>

        {/* Single Pro Card - Centered */}
        <div className="flex justify-center px-4 pb-24 sm:pb-16">
          <div className="w-full max-w-sm">
            {/* Pro Card */}
            <div className={`rounded-2xl border ${isProUser ? "border-amber-500/50" : "border-border"} bg-card p-5 sm:p-6 relative`}>
              {/* Badge */}
              <div className="absolute -top-3 left-4">
                {isProUser ? (
                  <span className="inline-flex items-center gap-1 bg-promo-muted text-promo text-xs font-semibold px-2.5 py-1 rounded-lg">
                    <Crown className="size-3" aria-hidden="true" />
                    {t("currentPlan")}
                  </span>
                ) : (
                  <span className="bg-promo text-promo-foreground text-xs font-semibold px-2.5 py-1 rounded-lg">
                    {t("popular")}
                  </span>
                )}
              </div>

              <div className="mb-4 pt-1">
                <h2 className="text-xl font-semibold">{t("pro")}</h2>
                <p className="text-sm text-muted-foreground">{t("forPowerReaders")}</p>
              </div>

              {/* Price Display */}
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  {billingPeriod === "annual" && (
                    <span className="text-xl font-medium text-price-strike line-through font-variant-numeric-tabular">${originalAnnualPrice}</span>
                  )}
                  <span className="text-4xl font-bold font-variant-numeric-tabular">
                    ${billingPeriod === "annual" ? annualPrice : monthlyPrice}
                  </span>
                  {billingPeriod === "annual" && (
                    <span className="text-sm font-medium text-success">50% off</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {billingPeriod === "annual"
                    ? `$${annualMonthly}/month, billed yearly`
                    : "billed monthly"
                  }
                </p>
              </div>

              {/* Billing Toggle - Improved visual states */}
              <fieldset className="mb-3 sm:mb-4">
                <legend className="sr-only">Billing period</legend>
                <div className="flex items-center gap-0.5 p-1 bg-muted rounded-xl">
                  <button
                    onClick={() => setBillingPeriod("annual")}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                      billingPeriod === "annual"
                        ? "bg-background text-foreground shadow-md ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                    aria-pressed={billingPeriod === "annual"}
                  >
                    {t("yearly")}
                  </button>
                  <button
                    onClick={() => setBillingPeriod("monthly")}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                      billingPeriod === "monthly"
                        ? "bg-background text-foreground shadow-md ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                    aria-pressed={billingPeriod === "monthly"}
                  >
                    {t("monthly")}
                  </button>
                </div>
              </fieldset>

            {/* CTA Button - hidden on mobile, shown in sticky footer */}
            <div className="hidden sm:block">
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

              {/* Reassurance text */}
              <p className="mt-3 text-xs text-muted-foreground text-center leading-relaxed">
                  No payment due now · Cancel anytime
                </p>
              </div>

              {/* Bypass Detection Feature - Highlighted */}
              <div className="mt-4 p-3 rounded-xl bg-success-muted border border-success/20">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-6 rounded-md bg-success text-success-foreground text-xs font-bold shrink-0">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Instant bypass detection</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Know immediately if the full article was retrieved
                    </p>
                  </div>
                </div>
                {/* Mini preview of indicators */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-success/10 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex size-4 items-center justify-center rounded bg-success/20 text-success text-[9px] font-bold">✓</span>
                    <span className="text-muted-foreground">Complete</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex size-4 items-center justify-center rounded bg-promo/20 text-promo text-[9px] font-bold">?</span>
                    <span className="text-muted-foreground">Uncertain</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex size-4 items-center justify-center rounded bg-price-strike/20 text-price-strike text-[9px]">🔒</span>
                    <span className="text-muted-foreground">Blocked</span>
                  </div>
                </div>
              </div>

              {/* Feature List - Condensed */}
              <ul className="mt-4 space-y-2" aria-label="Pro features">
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>1,000+ publications unlocked</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{t("unlimitedArticles")} &amp; AI summaries</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{t("premiumAiModels")}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{t("adFreeReading")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Publications + Cost Comparison */}
        <div className="relative py-12 sm:py-20 overflow-hidden border-t border-border">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/50 via-background to-background" aria-hidden="true" />

          <div className="relative max-w-4xl mx-auto px-4">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-4">
              {t("worksWith")}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-12 sm:mb-20" role="list" aria-label="Supported publications">
              {publications.map((pub) => (
                <span
                  key={pub}
                  role="listitem"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-card border border-border text-xs sm:text-sm font-medium text-foreground/80"
                >
                  {pub}
                </span>
              ))}
            </div>

            {/* Single comparison card - cleaner */}
            <div className="max-w-sm mx-auto">
              <div className="rounded-2xl border border-border bg-card p-5 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Instead of paying
                </p>
                <p className="text-2xl font-bold text-price-strike line-through font-variant-numeric-tabular opacity-60">
                  $50–100+/month
                </p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  NYT + WSJ + The Atlantic + more…
                </p>

                <div className="h-px bg-border my-4" />

                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Get everything for
                </p>
                <p className="text-4xl font-bold font-variant-numeric-tabular">
                  ${billingPeriod === "annual" ? annualMonthly : monthlyPrice}
                  <span className="text-lg font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="inline-flex items-center gap-1.5 mt-2 text-sm text-success font-medium">
                  <Check className="size-4" aria-hidden="true" />
                  Save 95%+ on news access
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof */}
        <div className="py-12 sm:py-20 px-4 border-t border-border bg-accent/30">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                260,000+ {t("activeUsers")}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-pretty">{t("lovedByReaders")}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {testimonials.map((item) => (
                <a
                  key={item.handle}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-foreground/20 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-center gap-3 mb-2 sm:mb-3">
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
                    <svg className="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

        {/* Footer CTA */}
        <div className="py-10 sm:py-12 px-4 border-t border-border bg-accent/30 pb-28 sm:pb-12">
          <div className="max-w-md mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {t("stillHaveQuestions")}{" "}
              <a
                href="https://x.com/michael_chomsky"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
              >
                {t("reachOut")}
              </a>
            </p>
            <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground flex-wrap">
              <span>{t("freeTrial")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("cancelAnytime")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("noQuestions")}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-background border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
        <p className="mt-2 text-xs text-muted-foreground text-center">
          No payment due now · Cancel anytime
        </p>
      </div>
    </div>
  );
}
