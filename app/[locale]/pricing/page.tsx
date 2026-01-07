"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { CheckoutButton, useSubscription, SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import { Check, X, ChevronDown, ArrowLeft, Crown } from "lucide-react";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { Link } from "@/i18n/navigation";
import Image from "next/image";

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

const PATRON_PLAN_ID = process.env.NEXT_PUBLIC_CLERK_PATRON_PLAN_ID || "";

const publications = [
  "Medium",
  "Business Insider",
  "Wired",
  "The Atlantic",
  "Foreign Policy",
  "Quora",
];

export default function PricingPage() {
  const t = useTranslations("pricing");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { data: _subscription } = useSubscription();
  const { isPremium, isLoading: isPremiumLoading } = useIsPremium();

  // Derive user state for UI (only used within SignedIn blocks)
  // These are stable after loading completes
  const isProUser = isPremium && !isPremiumLoading;
  const isFreeUser = !isPremium && !isPremiumLoading;

  const monthlyPrice = 7.99;
  const annualPrice = 36;
  const annualMonthly = annualPrice / 12;
  const savings = Math.round((1 - annualMonthly / monthlyPrice) * 100);

  const features = [
    { name: t("articlesPerDay"), free: "20", premium: t("unlimitedArticles") },
    { name: t("aiSummariesPerDay"), free: "20", premium: t("unlimitedAiSummaries") },
    { name: t("articlesInHistory"), free: "30", premium: t("unlimitedHistory") },
    { name: t("searchHistory"), free: false, premium: true },
    { name: t("adFreeReading"), free: false, premium: true },
  ];

  const faqs = [
    { q: t("faqHowWorks"), a: t("faqHowWorksAnswer") },
    { q: t("faqPublications"), a: t("faqPublicationsAnswer") },
    { q: t("faqCancel"), a: t("faqCancelAnswer") },
    { q: t("faqTrial"), a: t("faqTrialAnswer") },
    { q: t("faqPayment"), a: t("faqPaymentAnswer") },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Header - not sticky to avoid overlapping Clerk checkout sidebar */}
      <header className="bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 h-14">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 -ml-2 hover:bg-accent"
          >
            <ArrowLeft className="size-3.5" />
            <span>{t("backToSmry")}</span>
          </Link>

          <Link href="/" className="absolute left-1/2 -translate-x-1/2">
            <Image
              src="/logo.svg"
              width={80}
              height={28}
              alt="smry"
              className="dark:invert"
            />
          </Link>

          <div className="flex items-center">
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
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors px-3 py-1.5 rounded-md hover:bg-accent">
                  {t("signIn")}
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center px-4 pt-16 pb-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
          {t("readWithoutLimits")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground text-center max-w-md">
          {t("fullAccessFrom")}{" "}
          <span className="text-foreground font-medium">$0.10 {t("perDay")}</span> — {t("cancelAnytime")}.
        </p>

        {/* Billing Toggle */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="inline-flex items-center bg-accent rounded-full p-1">
            <button
              onClick={() => setBillingPeriod("annual")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                billingPeriod === "annual"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("yearly")}
            </button>
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                billingPeriod === "monthly"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("monthly")}
            </button>
          </div>
          {billingPeriod === "annual" && (
            <p className="text-sm text-muted-foreground">
              <span className="text-blue-500 font-semibold">
                {t("save")} {savings}%
              </span>{" "}
              {t("onYearly")}
            </p>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="flex justify-center px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
          {/* Free Card */}
          <div className={`rounded-2xl border border-border bg-card p-6 relative ${isProUser ? "opacity-60" : ""}`}>
            {/* Current Plan badge for free users */}
            {isFreeUser && (
              <div className="absolute -top-3 left-4">
                <span className="bg-muted text-foreground text-xs font-semibold px-2 py-1 rounded-lg border border-border">
                  {t("currentPlan")}
                </span>
              </div>
            )}
            {/* Included badge for pro users */}
            {isProUser && (
              <div className="absolute -top-3 left-4">
                <span className="bg-muted text-muted-foreground text-xs font-semibold px-2 py-1 rounded-lg border border-border">
                  {t("included")}
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-semibold">{t("free")}</h3>
              <p className="text-sm text-muted-foreground">{t("forCasualReaders")}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground ml-1">{t("forever")}</span>
            </div>

            {/* Different CTAs based on user state */}
            <SignedIn>
              {isFreeUser ? (
                <div className="w-full py-2.5 px-4 rounded-lg bg-accent/50 text-muted-foreground font-medium text-sm text-center border border-border">
                  {t("yourPlan")}
                </div>
              ) : isProUser ? (
                <Link
                  href="/"
                  className="block w-full py-2.5 px-4 rounded-lg bg-accent/50 text-muted-foreground font-medium text-sm text-center"
                >
                  {t("continueFree")}
                </Link>
              ) : (
                <Link
                  href="/"
                  className="block w-full py-2.5 px-4 rounded-lg bg-accent text-foreground font-medium text-sm text-center hover:bg-accent/80 transition-colors"
                >
                  {t("continueFree")}
                </Link>
              )}
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="w-full py-2.5 px-4 rounded-lg bg-accent text-foreground font-medium text-sm text-center hover:bg-accent/80 transition-colors">
                  {t("signUpFree")}
                </button>
              </SignInButton>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                {t("freeAccountBenefits")}
              </p>
            </SignedOut>

            <ul className="mt-6 space-y-3">
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>20 {t("articlesPerDay")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>20 {t("aiSummariesPerDay")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>30 {t("articlesInHistory")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground/50">
                <X className="size-4 shrink-0" />
                <span>{t("searchHistory")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground/50">
                <X className="size-4 shrink-0" />
                <span>{t("adFreeReading")}</span>
              </li>
            </ul>
          </div>

          {/* Pro Card */}
          <div className={`rounded-2xl border-2 ${isProUser ? "border-amber-500/50" : "border-foreground/20"} bg-card p-6 relative`}>
            {/* Badge: Current Plan for Pro users, Popular for others */}
            <div className="absolute -top-3 left-4">
              {isProUser ? (
                <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-semibold px-2 py-1 rounded-lg">
                  <Crown className="size-3" />
                  {t("currentPlan")}
                </span>
              ) : (
                <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-lg">
                  {t("popular")}
                </span>
              )}
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold">{t("pro")}</h3>
              <p className="text-sm text-muted-foreground">{t("forPowerReaders")}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">
                ${billingPeriod === "annual" ? annualMonthly.toFixed(0) : monthlyPrice}
              </span>
              <span className="text-muted-foreground ml-1">{t("perMonth")}</span>
              {billingPeriod === "annual" && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("billedYearly")} ${annualPrice}
                </p>
              )}
            </div>

            <SignedIn>
              {isProUser ? (
                <SubscriptionDetailsButton>
                  <button className="w-full py-2.5 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors">
                    {t("manageSubscription")}
                  </button>
                </SubscriptionDetailsButton>
              ) : (
                <div className="checkout-btn-primary">
                  <CheckoutButton
                    planId={PATRON_PLAN_ID}
                    planPeriod={billingPeriod === "annual" ? "annual" : "month"}
                  >
                    {t("upgradeToPro")}
                  </CheckoutButton>
                </div>
              )}
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="w-full py-2.5 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors">
                  {t("startFreeTrial")}
                </button>
              </SignInButton>
            </SignedOut>

            <ul className="mt-6 space-y-3">
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
                <span>{t("unlimitedHistory")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("searchAllPastArticles")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span>{t("adFreeReading")}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Publications + Cost Comparison - Unified Section */}
      <div className="relative py-20 overflow-hidden border-t border-border">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent/50 via-background to-background" />

        <div className="relative max-w-4xl mx-auto px-4">
          {/* Publications as styled chips */}
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

          {/* Visual Cost Comparison */}
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">{t("saveVsSubscriptions")}</h2>

            {/* Side by side comparison cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Individual subscriptions */}
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-xs text-muted-foreground mb-3">Individual subscriptions</p>
                <p className="text-2xl font-bold text-muted-foreground">$100+<span className="text-sm font-normal">/mo</span></p>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    NYT $17 + WSJ $20 + Bloomberg $35 + more...
                  </p>
                </div>
              </div>

              {/* smry Pro */}
              <div className="rounded-xl bg-foreground text-background p-4 relative">
                <div className="absolute -top-2 -right-2">
                  <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    SAVE 97%
                  </span>
                </div>
                <p className="text-xs text-background/70 mb-3">smry Pro</p>
                <p className="text-2xl font-bold">${billingPeriod === "annual" ? annualMonthly.toFixed(0) : monthlyPrice}<span className="text-sm font-normal">/mo</span></p>
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
          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              200,000+ {t("activeUsers")}
            </p>
            <h2 className="text-2xl font-bold tracking-tight">{t("lovedByReaders")}</h2>
          </div>

          {/* Testimonials Grid */}
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
                  <svg className="size-4 ml-auto text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{item.text}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="py-16 px-4 border-t border-border">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{t("comparePlans")}</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="text-left py-3 px-4 text-sm font-medium">{t("feature")}</th>
                  <th className="text-center py-3 px-4 text-sm font-medium">{t("free")}</th>
                  <th className="text-center py-3 px-4 text-sm font-medium">{t("pro")}</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, i) => (
                  <tr key={feature.name} className={i < features.length - 1 ? "border-b border-border" : ""}>
                    <td className="py-3 px-4 text-sm">{feature.name}</td>
                    <td className="py-3 px-4 text-center">
                      {typeof feature.free === "boolean" ? (
                        feature.free ? (
                          <Check className="size-4 mx-auto text-muted-foreground" />
                        ) : (
                          <X className="size-4 mx-auto text-muted-foreground/40" />
                        )
                      ) : (
                        <span className="text-sm text-muted-foreground">{feature.free}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof feature.premium === "boolean" ? (
                        feature.premium ? (
                          <Check className="size-4 mx-auto text-muted-foreground" />
                        ) : (
                          <X className="size-4 mx-auto text-muted-foreground/40" />
                        )
                      ) : (
                        <span className="text-sm font-medium">{feature.premium}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    className={`size-4 text-muted-foreground transition-transform ${
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
