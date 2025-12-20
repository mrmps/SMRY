"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { CheckoutButton, useSubscription, SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import { Check, X, ChevronDown, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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

const features = [
  { name: "Articles per day", free: "20", premium: "Unlimited" },
  { name: "AI summaries", free: "20/day", premium: "Unlimited" },
  { name: "Reading history", free: "30 articles", premium: "Unlimited" },
  { name: "Search history", free: false, premium: true },
  { name: "Ad-free experience", free: false, premium: true },
  { name: "Priority support", free: false, premium: true },
];

const faqs = [
  {
    q: "How does SMRY work?",
    a: "Paste any article URL and SMRY retrieves the full content, bypassing most paywalls. You also get an AI-generated summary to quickly understand the key points.",
  },
  {
    q: "What publications are supported?",
    a: "SMRY works with 1000+ sites including NYT, WSJ, Bloomberg, The Atlantic, Washington Post, Medium, and most major news outlets.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel with one click from your account settings. No questions asked, no cancellation fees.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes! Start with a 7-day free trial. You won't be charged until the trial ends, and you can cancel anytime.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, debit cards, and Apple Pay through our secure payment processor.",
  },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { data: subscription, isLoading: isSubscriptionLoading } = useSubscription();

  const monthlyPrice = 7.99;
  const annualPrice = 36;
  const annualMonthly = annualPrice / 12;
  const savings = Math.round((1 - annualMonthly / monthlyPrice) * 100);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back to SMRY</span>
          </Link>
          <Link href="/">
            <Image
              src="/logo.svg"
              width={70}
              height={70}
              alt="smry logo"
              className="dark:invert"
            />
          </Link>
          <div className="flex items-center gap-3">
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "size-8",
                  },
                }}
              />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center px-4 pt-16 pb-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
          Read without limits.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground text-center max-w-md">
          Full access to 1000+ publications from only{" "}
          <span className="text-foreground font-medium">$0.10 per day</span> — Cancel anytime.
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
              Yearly
            </button>
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                billingPeriod === "monthly"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
          </div>
          {billingPeriod === "annual" && (
            <p className="text-sm">
              <span className="text-green-600 dark:text-green-400 font-medium">
                Save {savings}%
              </span>{" "}
              <span className="text-muted-foreground">on a yearly subscription</span>
            </p>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="flex justify-center px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
          {/* Free Card */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="text-sm text-muted-foreground">For casual readers</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground ml-1">forever</span>
            </div>

            <Link
              href="/"
              className="block w-full py-2.5 px-4 rounded-lg bg-accent text-foreground font-medium text-sm text-center hover:bg-accent/80 transition-colors"
            >
              Continue free
            </Link>

            <ul className="mt-6 space-y-3">
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>20 articles per day</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>20 AI summaries per day</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>30 articles in history</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground/50">
                <X className="size-4 shrink-0" />
                <span>Search history</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground/50">
                <X className="size-4 shrink-0" />
                <span>Ad-free reading</span>
              </li>
            </ul>
          </div>

          {/* Pro Card */}
          <div className="rounded-2xl border-2 border-foreground/20 bg-card p-6 relative">
            <div className="absolute -top-3 left-4">
              <span className="bg-green-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                Popular
              </span>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="text-sm text-muted-foreground">For power readers</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">
                ${billingPeriod === "annual" ? annualMonthly.toFixed(0) : monthlyPrice}
              </span>
              <span className="text-muted-foreground ml-1">per month</span>
              {billingPeriod === "annual" && (
                <p className="text-xs text-muted-foreground mt-1">
                  billed ${annualPrice} yearly
                </p>
              )}
            </div>

            <SignedIn>
              {subscription?.plan?.id === PATRON_PLAN_ID ? (
                <SubscriptionDetailsButton>
                  <button className="w-full py-2.5 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors">
                    Manage subscription
                  </button>
                </SubscriptionDetailsButton>
              ) : (
                <div className="checkout-btn-primary">
                  <CheckoutButton
                    planId={PATRON_PLAN_ID}
                    planPeriod={billingPeriod === "annual" ? "annual" : "month"}
                  >
                    {subscription ? "Upgrade to Pro" : "Start 7-day free trial"}
                  </CheckoutButton>
                </div>
              )}
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="w-full py-2.5 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors">
                  Start 7-day free trial
                </button>
              </SignInButton>
            </SignedOut>

            <ul className="mt-6 space-y-3">
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-green-500" />
                <span>Unlimited articles</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-green-500" />
                <span>Unlimited AI summaries</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-green-500" />
                <span>Unlimited history</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-green-500" />
                <span>Search all past articles</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="size-4 shrink-0 text-green-500" />
                <span>Ad-free reading</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Publications */}
      <div className="py-12 border-t border-border">
        <p className="text-center text-sm text-muted-foreground mb-6">
          Works with 1000+ publications including
        </p>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 px-4 max-w-3xl mx-auto">
          {publications.map((pub) => (
            <span key={pub} className="text-sm font-medium text-muted-foreground">
              {pub}
            </span>
          ))}
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="py-16 px-4 border-t border-border">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Compare plans</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="text-left py-3 px-4 text-sm font-medium">Feature</th>
                  <th className="text-center py-3 px-4 text-sm font-medium">Free</th>
                  <th className="text-center py-3 px-4 text-sm font-medium">Pro</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, i) => (
                  <tr key={feature.name} className={i < features.length - 1 ? "border-b border-border" : ""}>
                    <td className="py-3 px-4 text-sm">{feature.name}</td>
                    <td className="py-3 px-4 text-center">
                      {typeof feature.free === "boolean" ? (
                        feature.free ? (
                          <Check className="size-4 mx-auto text-green-500" />
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
                          <Check className="size-4 mx-auto text-green-500" />
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
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
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
            Still have questions?{" "}
            <a
              href="https://x.com/michael_chomsky"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
            >
              Reach out on X
            </a>
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>7-day free trial</span>
            <span>•</span>
            <span>Cancel anytime</span>
            <span>•</span>
            <span>No questions asked</span>
          </div>
        </div>
      </div>
    </main>
  );
}
