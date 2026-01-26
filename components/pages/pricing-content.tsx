"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { CheckoutButton, SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import { Check, ChevronDown, ArrowLeft, CheckCircle, X } from "lucide-react";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
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
  "The New Yorker",
  "MIT Tech Review",
];

const getPublicationCategories = (t: (key: string) => string) => [
  { label: t("catNews"), pubs: ["NYT", "WSJ", "WaPo", "The Guardian"] },
  { label: t("catTech"), pubs: ["Wired", "MIT Tech", "The Verge", "Ars Technica"] },
  { label: t("catBusiness"), pubs: ["HBR", "Forbes", "Inc.", "Fast Company"] },
  { label: t("catCulture"), pubs: ["The Atlantic", "New Yorker", "Vanity Fair"] },
];

interface CTAButtonProps {
  variant: "desktop" | "mobile";
  hasMounted: boolean;
  isProUser: boolean;
  billingPeriod: BillingPeriod;
  manageSubscriptionLabel: string;
  ctaLabel: string;
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
  ctaLabel,
  onCheckoutOpen,
  onSubscriptionComplete,
  onSignedOutClick,
}: CTAButtonProps) {
  const baseStyles = variant === "desktop"
    ? "w-full py-2.5 px-4 rounded-xl bg-foreground text-background font-medium text-sm"
    : "w-full py-3 px-4 rounded-xl bg-foreground text-background font-medium text-sm";

  const interactiveStyles = "hover:bg-foreground/90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none";

  const ctaText = ctaLabel;

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

  const premiumFeatures = [
    t("premiumAiModels"),
    t("bypassIndicator"),
    t("unlimitedHistory"),
    t("adFreeReading"),
    t("prioritySupport"),
  ];

  const faqs = [
    { q: t("faqHowWorks"), a: t("faqHowWorksAnswer") },
    { q: t("faqPublications"), a: t("faqPublicationsAnswer") },
    { q: t("faqSiteSupport"), a: t("faqSiteSupportAnswer") },
    { q: t("faqCancel"), a: t("faqCancelAnswer") },
    { q: t("faqTrial"), a: t("faqTrialAnswer") },
    { q: t("faqLegal"), a: t("faqLegalAnswer") },
    { q: t("faqPayment"), a: t("faqPaymentAnswer") },
    { q: t("faqValue"), a: t("faqValueAnswer") },
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
            <span className="font-medium">{t("welcomeToPro")}</span>
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
            {t.rich("heroSubtitle", {
              price: annualMonthly,
              highlight: (chunks) => <span className="text-foreground">{chunks}</span>
            })}
          </p>
        </div>

        {/* Card */}
        <div className="flex justify-center px-4 pt-6 pb-24 sm:pb-16">
          <div className="w-full max-w-[340px]">
            <div className={`relative rounded-2xl border ${isProUser ? "border-[var(--p3-gold)]/30 shadow-[0_0_32px_-8px_var(--p3-gold)]" : "border-foreground/[0.08]"} bg-card px-5 py-5 shadow-sm`}>

              {/* Billing Toggle */}
              <div className="flex justify-center mb-5">
                <Tabs
                  value={billingPeriod}
                  onValueChange={(value) => setBillingPeriod(value as BillingPeriod)}
                >
                  <TabsList>
                    <TabsTab value="monthly" className="px-4">
                      {t("billingMonthly")}
                    </TabsTab>
                    <TabsTab value="annual" className="gap-1.5 px-4">
                      {t("billingAnnually")}
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        {t("discountBadge")}
                      </span>
                    </TabsTab>
                  </TabsList>
                </Tabs>
              </div>

              {/* Price */}
              <div className="text-center mb-5">
                <div className="flex items-baseline justify-center gap-1">
                  {billingPeriod === "annual" && (
                    <span className="text-xl text-muted-foreground/40 line-through tabular-nums font-medium">${originalAnnualPrice}</span>
                  )}
                  <span className="text-4xl font-bold tabular-nums tracking-tight">
                    ${billingPeriod === "annual" ? annualPrice : monthlyPrice}
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground mt-1">
                  {billingPeriod === "annual"
                    ? t.rich("billedAsYearly", {
                        price: annualPrice,
                        savings: originalAnnualPrice - annualPrice,
                        highlight: (chunks) => <span className="text-foreground font-medium">{chunks}</span>
                      })
                    : t("perMonthShort")
                  }
                </p>
              </div>

              {/* Quick stats */}
              <div className="space-y-1.5 mb-5">
                {[
                  { label: t("statPublications"), value: t("stat1000Plus") },
                  { label: t("statArticles"), value: t("statUnlimited") },
                  { label: t("statFeatures"), value: t("statEverything") },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between h-9 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]"
                  >
                    <span className="text-[14px] font-medium">{stat.label}</span>
                    <span className="text-[14px] text-muted-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="hidden sm:block">
                <CTAButton
                  variant="desktop"
                  hasMounted={hasMounted}
                  isProUser={isProUser}
                  billingPeriod={billingPeriod}
                  manageSubscriptionLabel={t("manageSubscription")}
                  ctaLabel={t("startFreeTrial")}
                  onCheckoutOpen={() => handleCheckoutOpen(billingPeriod)}
                  onSubscriptionComplete={() => setShowSuccess(true)}
                  onSignedOutClick={() => storeReturnUrl(returnUrlFromParams || undefined)}
                />
                <p className="mt-2 text-[11px] text-muted-foreground/70 text-center">
                  {t("trialAndCancel")}
                </p>
              </div>

              {/* Features */}
              <div className="mt-4 pt-4">
                <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5" aria-label="Pro features">
                  {premiumFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-[12px] text-foreground/70">
                      <Check className="size-3 shrink-0 text-[var(--p3-emerald)]" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid - Bento Style */}
        <div className="mx-auto max-w-[960px] px-5 py-10 border-t border-border">
          {/* On mobile, stack as complete sections (heading + visual). On desktop, alternate sides */}
          <div className="flex flex-col gap-6 lg:gap-0 lg:grid lg:grid-cols-2">
            {/* Section 1: How it works - Desktop: Visual left, Text right */}
            <div className="order-1 lg:order-2 flex flex-col items-center justify-center gap-2.5 px-6 py-6 lg:py-0 text-center lg:h-[300px]">
              <h2 className="max-w-[280px] text-lg font-medium leading-6 tracking-[-0.2px] text-foreground">
                {t("featureHowItWorksTitle")}
              </h2>
              <p className="max-w-[280px] text-[14px] leading-5 text-muted-foreground">
                {t("featureHowItWorksDesc")}
              </p>
            </div>
            <div className="order-2 lg:order-1 flex h-[220px] sm:h-[260px] lg:h-[300px] items-center justify-center rounded-2xl bg-[#f5f5f5] dark:bg-[#111]">
              <div className="flex flex-col gap-3 px-6">
                {[
                  { step: "1", text: t("stepPasteUrl"), color: "bg-foreground text-background" },
                  { step: "2", text: t("stepFetchSources"), color: "bg-muted text-muted-foreground" },
                  { step: "3", text: t("stepReadWithout"), color: "bg-muted text-muted-foreground" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <span className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${item.color}`}>
                      {item.step}
                    </span>
                    <span className="text-sm text-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Comparison - Desktop: Text left, Visual right */}
            <div className="order-3 lg:order-3 flex flex-col items-center justify-center gap-2.5 px-6 py-6 lg:py-0 text-center lg:h-[300px]">
              <h2 className="max-w-[280px] text-lg font-medium leading-6 tracking-[-0.2px] text-foreground">
                {t("featureCompareTitle")}
              </h2>
              <p className="max-w-[280px] text-[14px] leading-5 text-muted-foreground">
                {t("featureCompareDesc", { price: billingPeriod === "annual" ? annualMonthly : monthlyPrice })}
              </p>
            </div>
            <div className="order-4 lg:order-4 flex h-[180px] sm:h-[220px] lg:h-[300px] items-center justify-center rounded-2xl bg-[#f5f5f5] dark:bg-[#111]">
              <div className="w-full max-w-[280px] overflow-hidden rounded-xl bg-white p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:bg-[#222] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] mx-4">
                <div className="space-y-2 sm:space-y-2.5">
                  {[
                    { feature: t("compareAiSummaries"), free: t("comparePerDay", { count: 20 }), pro: t("statUnlimited") },
                    { feature: t("compareAiQuality"), free: t("compareBasic"), pro: t("comparePremium") },
                    { feature: t("compareBypassDetection"), free: "—", pro: <Check className="size-3.5 text-emerald-500" /> },
                    { feature: t("compareAdFree"), free: "—", pro: <Check className="size-3.5 text-emerald-500" /> },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">{row.feature}</span>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-muted-foreground/50 w-14 sm:w-16 text-right">{row.free}</span>
                        <span className="text-foreground font-medium w-16 sm:w-20 text-right flex justify-end">{row.pro}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 3: Publications - Desktop: Visual left, Text right */}
            <div className="order-5 lg:order-6 flex flex-col items-center justify-center gap-2.5 px-6 py-6 lg:py-0 text-center lg:h-[300px]">
              <h2 className="max-w-[280px] text-lg font-medium leading-6 tracking-[-0.2px] text-foreground">
                {t("featurePubsTitle")}
              </h2>
              <p className="max-w-[280px] text-[14px] leading-5 text-muted-foreground">
                {t("featurePubsDesc")}
              </p>
            </div>
            <div className="order-6 lg:order-5 flex h-[200px] sm:h-[240px] lg:h-[300px] items-center justify-center rounded-2xl bg-[#f5f5f5] dark:bg-[#111]">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 px-4 sm:px-6 w-full max-w-[320px]">
                {getPublicationCategories(t).map((cat) => (
                  <div key={cat.label} className="rounded-lg bg-white/80 dark:bg-[#222]/80 p-2 sm:p-2.5">
                    <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{cat.label}</p>
                    <div className="space-y-0.5">
                      {cat.pubs.slice(0, 3).map((pub) => (
                        <p key={pub} className="text-[10px] sm:text-[11px] text-foreground/80">{pub}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Value Comparison */}
        <div className="py-12 sm:py-16 px-4 border-t border-border">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{t("mathTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("mathSubtitle")}</p>
            </div>

            {/* Comparison rows */}
            <div className="space-y-2 mb-4">
              {[
                { pub: "New York Times", price: "$17" },
                { pub: "Wall Street Journal", price: "$20" },
                { pub: "The Atlantic", price: "$10" },
                { pub: "Washington Post", price: "$10" },
              ].map((item) => (
                <div
                  key={item.pub}
                  className="flex items-center justify-between h-10 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.03]"
                >
                  <span className="text-[14px] text-muted-foreground">{item.pub}</span>
                  <span className="text-[14px] text-muted-foreground/50 line-through">{item.price}/mo</span>
                </div>
              ))}
            </div>

            {/* Total vs smry */}
            <div className="rounded-xl bg-foreground text-background px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[14px] font-medium">{t("smryProLabel")}</span>
                  <span className="text-[12px] text-background/60 ml-2">{t("smryProSubtext")}</span>
                </div>
                <span className="text-lg font-bold tabular-nums">${billingPeriod === "annual" ? annualMonthly : monthlyPrice}/mo</span>
              </div>
            </div>

            {/* Savings callout */}
            <p className="text-center text-[13px] text-muted-foreground mt-4">
              {t.rich("savingsCallout", {
                savings: 57 - (billingPeriod === "annual" ? annualMonthly : monthlyPrice),
                highlight: (chunks) => <span className="text-foreground font-medium">{chunks}</span>
              })}
            </p>
          </div>
        </div>

        {/* Social Proof */}
        <div className="py-12 sm:py-20 px-4 border-t border-border">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{t("lovedByReaders")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("joinReaders")}</p>
            </div>

            {/* Stats rows - clean, scannable */}
            <div className="space-y-2 mb-8">
              {[
                { label: t("statMonthlySavings"), value: t("statSavingsValue") },
                { label: t("statArticlesRead"), value: t("statArticlesValue") },
                { label: t("statSuccessRate"), value: t("statSuccessValue") },
                { label: t("statUserRating"), value: t("statRatingValue") },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between h-10 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.03]"
                >
                  <span className="text-[14px] font-medium">{stat.label}</span>
                  <span className="text-[14px] text-muted-foreground">{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Testimonials - compact inline cards */}
            <div className="space-y-2">
              {testimonials.slice(0, 3).map((item) => (
                <a
                  key={item.handle}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 px-4 py-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Image
                    src={item.avatar}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 rounded-full bg-muted object-cover shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-foreground/90 leading-snug line-clamp-2">{item.text}</p>
                    <p className="text-[13px] text-muted-foreground mt-1">{item.name} <span className="opacity-60">{item.handle}</span></p>
                  </div>
                  <svg className="size-3.5 shrink-0 text-muted-foreground/40 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              ))}
            </div>

            {/* Trust footer */}
            <p className="text-[13px] text-muted-foreground/60 text-center mt-6">
              {t("securePayments")}
            </p>
          </div>
        </div>

        {/* Risk Reversal Guarantee */}
        <div className="py-12 sm:py-16 px-4 border-t border-border">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{t("guaranteeTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("guaranteeSubtitle")}</p>
            </div>

            {/* Guarantee rows - clean, scannable */}
            <div className="space-y-2">
              {[
                { label: t("guaranteeTrialLabel"), value: t("guaranteeTrialValue") },
                { label: t("guaranteeRefundLabel"), value: t("guaranteeRefundValue") },
                { label: t("guaranteeCancelLabel"), value: t("guaranteeCancelValue") },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between h-10 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.03]"
                >
                  <span className="text-[14px] font-medium">{item.label}</span>
                  <span className="text-[14px] text-muted-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="py-12 sm:py-16 px-4 border-t border-border">
          <div className="max-w-xl mx-auto">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-center mb-6">{t("faqTitle")}</h2>
            <div className="space-y-1.5">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl bg-black/[0.025] dark:bg-white/[0.025] overflow-hidden">
                  <button
                    id={`faq-question-${i}`}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenFaq(openFaq === i ? null : i);
                      }
                    }}
                    className="w-full flex items-center justify-between py-3 px-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
                    aria-expanded={openFaq === i}
                    aria-controls={`faq-answer-${i}`}
                  >
                    <span className="text-[14px] font-medium text-foreground pr-4">{faq.q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-4 shrink-0 text-muted-foreground/40 transition-transform duration-200 motion-reduce:transition-none ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    id={`faq-answer-${i}`}
                    className={`overflow-hidden transition-all duration-200 motion-reduce:transition-none ${
                      openFaq === i ? "max-h-[500px]" : "max-h-0"
                    }`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                  >
                    <div className="px-4 pb-3 text-[14px] leading-relaxed text-muted-foreground">
                      {faq.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Final CTA Section */}
        <div className="py-12 sm:py-16 px-4 border-t border-border pb-32 sm:pb-16">
          <div className="max-w-md mx-auto text-center">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-2">
              {t("finalCtaTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t("joinReaders")}
            </p>

            {/* Desktop final CTA */}
            <div className="hidden sm:block max-w-xs mx-auto">
              <CTAButton
                variant="desktop"
                hasMounted={hasMounted}
                isProUser={isProUser}
                billingPeriod={billingPeriod}
                manageSubscriptionLabel={t("manageSubscription")}
                ctaLabel={t("startFreeTrial")}
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
                {t("guarantee30Day")}
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
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-background border-t border-foreground/[0.05] px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-semibold tabular-nums tracking-tight">
              ${billingPeriod === "annual" ? annualMonthly : monthlyPrice}/mo
            </span>
            {billingPeriod === "annual" && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{t("discountOff")}</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">{t("freeTrialShort")}</span>
        </div>
        <CTAButton
          variant="mobile"
          hasMounted={hasMounted}
          isProUser={isProUser}
          billingPeriod={billingPeriod}
          manageSubscriptionLabel={t("manageSubscription")}
          ctaLabel={t("startFreeTrial")}
          onCheckoutOpen={() => handleCheckoutOpen(billingPeriod)}
          onSubscriptionComplete={() => setShowSuccess(true)}
          onSignedOutClick={() => storeReturnUrl(returnUrlFromParams || undefined)}
        />
      </div>
    </div>
  );
}
