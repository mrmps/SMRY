"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname;
      const search = searchParams?.toString();
      if (search) url += `?${search}`;
      ph.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, ph]);

  return null;
}

/**
 * Identifies signed-in users and enriches with properties for:
 * - Cohort analysis (power users, plan tier segmentation)
 * - New vs returning user tracking ($set_once for first visit data)
 * - DAU/MAU ratio (automatic via $pageview + identify)
 * - Churn analysis (automatic via lifecycle insight)
 */
function PostHogIdentify() {
  const ph = usePostHog();
  const { user, isLoaded: userLoaded } = useUser();
  const { isLoaded: authLoaded, has, isSignedIn } = useAuth();
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!ph || !userLoaded || !authLoaded) return;

    if (isSignedIn && user) {
      // Don't re-identify if same user
      if (prevUserId.current === user.id) return;
      prevUserId.current = user.id;

      const isPremium = has?.({ plan: "premium" }) ?? false;

      // $set updates on every identify, $set_once only sets on first call
      ph.identify(user.id, {
        // $set properties — updated on every visit
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName ?? user.firstName,
        is_premium: isPremium,
        plan: isPremium ? "premium" : "free",
        last_seen: new Date().toISOString(),
      }, {
        // $set_once properties — only set on first ever identify
        signup_date: user.createdAt?.toISOString(),
        initial_referrer: document.referrer || "$direct",
        initial_utm_source: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
        initial_utm_medium: new URLSearchParams(window.location.search).get("utm_medium") ?? undefined,
        initial_utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
      });

      // Group analytics for plan-level metrics
      ph.group("plan_tier", isPremium ? "premium" : "free", {
        plan: isPremium ? "premium" : "free",
      });
    } else {
      if (prevUserId.current !== null) {
        prevUserId.current = null;
        ph.reset();
      }
    }
  }, [ph, user, userLoaded, authLoaded, isSignedIn, has]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) return;

    posthog.init(key, {
      api_host: host,
      // Manual pageview capture for SPA route changes
      capture_pageview: false,
      capture_pageleave: true,
      // Autocapture: button clicks, form submits, link clicks
      autocapture: true,
      // Heatmaps: see where users click and scroll
      enable_heatmaps: true,
      // Session recording: replay user sessions with console logs
      capture_dead_clicks: true,
      enable_recording_console_log: true,
      session_recording: {
        recordCrossOriginIframes: true,
      },
      // Persist across sessions for returning user tracking
      persistence: "localStorage+cookie",
      // Capture performance data for Web Vitals
      capture_performance: true,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
