"use client";

import { useTranslations } from "next-intl";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { Check } from "lucide-react";

// Clerk plan ID from dashboard
const PATRON_PLAN_ID = "cplan_36Vi5qaiHA0417wdNSZjHSJrjxI";

export function CustomPricingTable() {
  const t = useTranslations("pricing");

  const features = [
    t("unlimitedAiSummaries"),
    t("premiumAiModels"),
    t("bypassIndicator"),
    t("fullHistory"),
    t("searchAllPastArticles"),
    t("adFreeReading"),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      {/* Monthly */}
      <div className="p-0.5 bg-accent rounded-[14px]">
        <div className="bg-card rounded-xl p-6 h-full flex flex-col">
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">{t("monthly")}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">$4.99</span>
              <span className="text-muted-foreground">/{t("perMonth").split(" ")[0]}</span>
            </div>
          </div>

          <ul className="space-y-2 mb-6 flex-1">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <SignedIn>
            <div className="checkout-btn-secondary">
              <CheckoutButton planId={PATRON_PLAN_ID} planPeriod="month">
                {t("startFreeTrial")}
              </CheckoutButton>
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="w-full py-2.5 px-4 rounded-lg bg-accent text-foreground font-medium text-sm hover:bg-accent/80 transition-colors border border-border">
                {t("signIn")}
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>

      {/* Annual - Highlighted */}
      <div className="p-0.5 bg-gradient-to-b from-foreground/20 to-foreground/5 rounded-[14px] relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-foreground text-background text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
            {t("popular")}
          </span>
        </div>
        <div className="bg-card rounded-xl p-6 h-full flex flex-col">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-muted-foreground">{t("yearly")}</p>
              <span className="text-xs font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                {t("save")} 50%
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">$2.50</span>
              <span className="text-muted-foreground">/{t("perMonth").split(" ")[0]}</span>
              <span className="text-sm text-muted-foreground line-through">$4.99</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("billedYearly")} $30</p>
          </div>

          <ul className="space-y-2 mb-6 flex-1">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <SignedIn>
            <div className="checkout-btn-primary">
              <CheckoutButton planId={PATRON_PLAN_ID} planPeriod="annual">
                {t("startFreeTrial")}
              </CheckoutButton>
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="w-full py-2.5 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors">
                {t("signIn")}
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </div>
  );
}
