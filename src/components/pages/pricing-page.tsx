"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import {
  CheckoutButton,
  useSubscription,
  SubscriptionDetailsButton,
} from "@clerk/clerk-react/experimental";
import { Check, X, ChevronDown, ArrowLeft, Crown } from "lucide-react";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { useTranslations } from "@/i18n";
import { LocalizedLink as Link } from "@/i18n/navigation";

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
const PATRON_PLAN_ID = "cplan_36Vi5qaiHA0417wdNSZjHSJrjxI";

const publications = [
  "Medium",
  "Business Insider",
  "Wired",
  "The Atlantic",
  "Foreign Policy",
  "Quora",
];

export function PricingPage() {
  const t = useTranslations("pricing");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { data: subscription } = useSubscription();
  const { isPremium, isLoading: isPremiumLoading } = useIsPremium();

  const isProUser = isPremium && !isPremiumLoading;
  const isFreeUser = !isPremium && !isPremiumLoading;

  const monthlyPrice = 4.99;
  const annualPrice = 30;
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
      <header className="bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 h-14">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 -ml-2 hover:bg-accent"
          >
            <ArrowLeft className="size-3.5" />
            <span>{t("backToSmry")}</span>
          </Link>

          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <img src="/logo.svg" width={80} height={28} alt="smry" className="dark:invert" />
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

      <div className="flex flex-col items-center px-4 pt-16 pb-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
          {t("readWithoutLimits")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground text-center max-w-md">
          {t("fullAccessFrom")} {" "}
          <span className="text-foreground font-medium">$0.08 {t("perDay")}</span> — {t("cancelAnytime")}.
        </p>

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

      <div className="flex justify-center px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
          <div className={`rounded-2xl border border-border bg-card p-6 relative ${
            isProUser ? "opacity-60" : ""
          }`}>
            {isFreeUser && (
              <div className="absolute -top-3 left-4">
                <span className="bg-muted text-foreground text-xs font-semibold px-2 py-1 rounded-lg border border-border">
                  {t("currentPlan")}
                </span>
              </div>
            )}
            {isProUser && (
              <div className="absolute -top-3 left-4">
                <span className="bg-muted text-muted-foreground text-xs font-semibold px-2 py-1 rounded-lg border border-border">
                  {t("included")}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t("freePlan")}</p>
              <h3 className="text-3xl font-bold">$0</h3>
              <p className="text-sm text-muted-foreground">{t("freeDescription")}</p>
            </div>

            <div className="mt-6 space-y-3">
              {features.map((feature) => (
                <div key={feature.name} className="flex items-center gap-2 text-sm">
                  {feature.free ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <X className="size-4 text-muted-foreground" />
                  )}
                  <span>{feature.name}</span>
                  {typeof feature.free === "string" && (
                    <span className="ml-auto text-xs text-muted-foreground">{feature.free}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary bg-card p-6 relative shadow-lg shadow-primary/10">
            {!subscription && (
              <div className="absolute -top-3 left-4">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-lg">
                  {t("mostPopular")}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t("premiumPlan")}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold">
                  {billingPeriod === "monthly" ? `$${monthlyPrice}` : `$${annualMonthly.toFixed(2)}`}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {billingPeriod === "monthly" ? "/mo" : `${t("perMonthBilledYearly")}`}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{t("premiumDescription")}</p>
            </div>

            <div className="mt-6 space-y-3">
              {features.map((feature) => (
                <div key={feature.name} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary" />
                  <span>{feature.name}</span>
                  {typeof feature.premium === "string" && (
                    <span className="ml-auto text-xs text-muted-foreground">{feature.premium}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6">
              {subscription ? (
                <SubscriptionDetailsButton>
                  <button className="w-full rounded-xl border border-border bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80 transition-colors">
                    {t("manageSubscription")}
                  </button>
                </SubscriptionDetailsButton>
              ) : (
                <CheckoutButton
                  planId={PATRON_PLAN_ID}
                  planPeriod={billingPeriod === "monthly" ? "month" : "annual"}
                >
                  <button className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
                    {t("upgrade")}
                  </button>
                </CheckoutButton>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-8 md:grid-cols-3">
            {publications.map((publication) => (
              <div
                key={publication}
                className="rounded-2xl border border-border bg-background p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                    <Crown className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("worksGreatWith")}</p>
                    <p className="text-base font-semibold">{publication}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={faq.q} className="rounded-2xl border border-border">
                <button
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <div>
                    <p className="font-medium">{faq.q}</p>
                    {openFaq === index && (
                      <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
                    )}
                  </div>
                  <ChevronDown
                    className={`size-5 text-muted-foreground transition-transform ${
                      openFaq === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map((testimonial) => (
              <a
                key={testimonial.handle}
                href={testimonial.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-border bg-background p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/50"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="size-12 rounded-full"
                    loading="lazy"
                  />
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.handle}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{testimonial.text}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
