"use client";

import { useTranslations } from "next-intl";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { Check } from "lucide-react";

// Clerk plan ID from dashboard
const PATRON_PLAN_ID = "cplan_36Vi5qaiHA0417wdNSZjHSJrjxI";

// Detect device type from user agent
function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let browser = "Unknown";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";

  return { deviceType, browser, os, referrer: document.referrer || undefined, page: window.location.pathname };
}

// Track buy button clicks
function trackBuyClick(plan: "monthly" | "annual", user?: { email?: string; name?: string }) {
  const device = getDeviceInfo();
  fetch("/api/webhooks/track/buy-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan,
      userEmail: user?.email,
      userName: user?.name,
      isSignedIn: !!user,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      referrer: device.referrer,
      page: device.page,
    }),
  }).catch(() => {
    // Silent fail - tracking shouldn't break the UI
  });
}

export function CustomPricingTable() {
  const t = useTranslations("pricing");
  const { user } = useUser();

  const userInfo = user ? {
    email: user.primaryEmailAddress?.emailAddress,
    name: user.firstName || undefined,
  } : undefined;

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
              <span className="text-3xl font-bold">$6</span>
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
            <div className="checkout-btn-secondary" onClick={() => trackBuyClick("monthly", userInfo)}>
              <CheckoutButton planId={PATRON_PLAN_ID} planPeriod="month">
                {t("startFreeTrial")}
              </CheckoutButton>
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              We&apos;ll email you before you&apos;re charged
            </p>
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
              <span className="text-3xl font-bold">$3</span>
              <span className="text-muted-foreground">/{t("perMonth").split(" ")[0]}</span>
              <span className="text-sm text-muted-foreground line-through">$6</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("billedYearly")} $36</p>
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
            <div className="checkout-btn-primary" onClick={() => trackBuyClick("annual", userInfo)}>
              <CheckoutButton planId={PATRON_PLAN_ID} planPeriod="annual">
                {t("startFreeTrial")}
              </CheckoutButton>
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              We&apos;ll email you before you&apos;re charged
            </p>
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
