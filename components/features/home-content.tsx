"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import {
  ArrowRight,
  ChevronDown,
  Check,
  X,
  Ban,
  CheckCircle,
  FileText,
} from "@/components/ui/icons";
import { useRouter } from "next/navigation";
import { z } from "zod";
import clsx from "clsx";
import { NormalizedUrlSchema } from "@/lib/validation/url";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BottomCornerNav } from "@/components/shared/bottom-corner-nav";
import { Footer } from "@/components/shared/footer";
import { FAQ } from "@/components/marketing/faq";
import { AuthBar } from "@/components/shared/auth-bar";
import { PromoBanner } from "@/components/marketing/promo-banner";
// import { UpdateBanner } from "@/components/marketing/update-banner";
import { GravityAd } from "@/components/ads/gravity-ad";
import { useGravityAd } from "@/lib/hooks/use-gravity-ad";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { getLastUnfinishedArticle, clearReadingProgress } from "@/lib/hooks/use-reading-progress";
import { FaviconImage } from "@/components/shared/favicon-image";
import { getSiteConfidence } from "@/lib/data/site-confidence";
import { SiteConfidenceIndicator } from "@/components/features/site-confidence-indicator";

// Empty subscribe function for useSyncExternalStore
const emptySubscribe = () => () => {};

// Hoisted RegExp patterns for URL validation (performance optimization)
const TLD_REGEX = /\.[a-zA-Z]{2,}/;
const HTTP_REGEX = /^https?:\/\//i;


// Feature Grid Cell - visual card with rounded background
function FeatureVisual({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx(
      "relative flex h-[280px] sm:h-[320px] lg:h-[340px] items-center justify-center overflow-hidden rounded-2xl",
      "bg-muted",
      className
    )}>
      {children}
    </div>
  );
}

// Feature Grid Cell - text content
function FeatureText({ title, description, className }: { title: string; description: string; className?: string }) {
  return (
    <div className={clsx(
      "flex py-8 lg:py-0 lg:h-[340px] flex-col items-center justify-center gap-2.5 px-6 text-center",
      className
    )}>
      <h2 className="max-w-[300px] text-lg font-medium leading-6 tracking-[-0.2px] text-foreground text-balance">
        {title}
      </h2>
      <p className="max-w-[300px] text-[14px] leading-5 text-muted-foreground text-pretty">
        {description}
      </p>
    </div>
  );
}

// Source Fetching Card Visual
function SourceFetchCard({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  return (
    <div className="relative flex w-full max-w-[320px] flex-col gap-3">
      {/* Vertical timeline line */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/50" />

      {/* Badge */}
      <div className="relative z-10 flex justify-center">
        <div className="flex items-center justify-center rounded-full bg-card/80 px-2.5 py-1 text-sm font-medium text-muted-foreground backdrop-blur-sm">
          {t("fetchingBadge")}
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 flex w-full max-w-[320px] flex-col gap-0.5 overflow-hidden rounded-xl bg-card p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-center px-2 py-1.5">
          <p className="text-xs text-muted-foreground">
            {t("racingSources", { count: 2 })}
          </p>
        </div>

        <div className="flex flex-col gap-[1.5px] overflow-hidden">
          <div className="rounded-lg bg-surface-1">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} />
                <span className="truncate text-sm text-foreground">{t("sourceWayback")}</span>
              </div>
              <span className="text-[13px] text-emerald-500">{t("statusWinner")}</span>
            </div>
          </div>

          <div className="rounded-lg bg-surface-1">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <Ban className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                <span className="truncate text-sm text-foreground">{t("sourceDirect")}</span>
              </div>
              <span className="text-[13px] text-muted-foreground">{t("statusPaywalled")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            <span className="truncate">nytimes.com/article</span>
          </div>
          <span className="text-[13px] text-muted-foreground">0.8s</span>
        </div>
      </div>
    </div>
  );
}

// Clean Reading Card Visual
function CleanReadingCard({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  return (
    <div className="relative flex w-full max-w-[320px] flex-col gap-3">
      {/* Vertical timeline line */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/50" />

      {/* Badge */}
      <div className="relative z-10 flex justify-center">
        <div className="flex items-center justify-center rounded-full bg-card/80 px-2.5 py-1 text-sm font-medium text-muted-foreground backdrop-blur-sm">
          {t("cleanModeBadge")}
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 flex w-full max-w-[320px] flex-col gap-0.5 overflow-hidden rounded-xl bg-card p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-center px-2 py-1.5">
          <p className="text-xs text-muted-foreground">
            {t("removedDistractions", { count: 12 })}
          </p>
        </div>

        <div className="flex flex-col gap-[1.5px] overflow-hidden">
          <div className="rounded-lg bg-surface-1">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-foreground">{t("paywallOverlay")}</span>
              </div>
              <span className="text-[13px] text-red-400">{t("statusRemoved")}</span>
            </div>
          </div>

          <div className="rounded-lg bg-surface-1">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-foreground">{t("cookieBanner")}</span>
              </div>
              <span className="text-[13px] text-red-400">{t("statusRemoved")}</span>
            </div>
          </div>

          <div className="rounded-lg bg-surface-1">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-foreground">{t("sidebarAds", { count: 3 })}</span>
              </div>
              <span className="text-[13px] text-red-400">{t("statusRemoved")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" strokeWidth={2} />
            <span>{t("readyToRead")}</span>
          </div>
          <span className="text-[13px] text-emerald-500">2,847 words</span>
        </div>
      </div>
    </div>
  );
}

// AI Summary Card Visual
function AISummaryCard({ t }: { t: (key: string) => string }) {
  return (
    <div className="w-full max-w-[280px] overflow-hidden rounded-xl bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{t("summaryLabel")}</span>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-full rounded-full bg-surface-2" />
        <div className="h-2.5 w-[90%] rounded-full bg-surface-2" />
        <div className="h-2.5 w-[95%] rounded-full bg-surface-2" />
        <div className="h-2.5 w-[70%] rounded-full bg-surface-2" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["EN", "DE", "ES", "FR", "PT", "NL", "ZH", "JA"].map((lang) => (
          <span
            key={lang}
            className={clsx(
              "rounded-md px-2 py-0.5 text-[11px] font-medium",
              lang === "EN"
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                : "bg-surface-2 text-muted-foreground"
            )}
          >
            {lang}
          </span>
        ))}
      </div>
    </div>
  );
}

// Hook to detect if device is desktop (for autoFocus)
// Returns true only for non-touch desktop devices to avoid keyboard popup on mobile
function useIsDesktop() {
  return useSyncExternalStore(
    emptySubscribe,
    () => {
      const isWideScreen = window.matchMedia("(min-width: 768px)").matches;
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      return isWideScreen && !isTouchDevice;
    },
    () => false // Return false on server to prevent autoFocus in SSR HTML
  );
}

const urlSchema = z.object({
  url: NormalizedUrlSchema,
});

// Validate and return error message if invalid, null if valid
function getValidationError(input: string): string | null {
  if (!input.trim()) return null;
  const result = urlSchema.safeParse({ url: input });
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Please enter a valid URL.";
}

// Check if input looks like a URL attempt (has domain-like structure)
function looksLikeUrlAttempt(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  // Has a dot followed by at least 2 chars (TLD-like), or starts with http
  return TLD_REGEX.test(trimmed) || HTTP_REGEX.test(trimmed);
}

// Continue Reading card - shown when user has an unfinished article
function ContinueReadingCard({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const article = useMemo(() => {
    if (!mounted) return null;
    return getLastUnfinishedArticle();
  }, [mounted]);
  const [dismissed, setDismissed] = useState(false);

  if (!article || dismissed) return null;

  const proxyUrl = `/proxy?url=${encodeURIComponent(article.url)}`;

  return (
    <div className="mt-4 sm:mt-8 sm:mb-12 w-full animate-in fade-in duration-300">
      <Link
        href={proxyUrl}
        className="group relative flex items-center gap-3 rounded-lg sm:rounded-xl border border-border/30 bg-card/40 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur-sm transition-colors hover:bg-card/60"
      >
        {/* Favicon */}
        <div className="size-5 shrink-0 overflow-hidden rounded">
          <FaviconImage domain={article.domain} className="size-full" />
        </div>

        {/* Title + domain */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] sm:text-sm font-medium text-foreground truncate group-hover:text-foreground/90">
            {article.title}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[10px] sm:text-[11px] text-muted-foreground/50">{article.domain}</span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground/30">·</span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground/50">
              {t("continueReadingProgress", { progress: article.progress })}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1 h-0.5 sm:h-1 w-full overflow-hidden rounded-full bg-foreground/[0.04]">
            <div
              className="h-full rounded-full bg-foreground/15 transition-[width] duration-300"
              style={{ width: `${article.progress}%` }}
            />
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearReadingProgress(article.url);
            setDismissed(true);
          }}
          className="shrink-0 p-1 rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/[0.05] transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-3" />
        </button>
      </Link>
    </div>
  );
}

export const HomeContent = memo(function HomeContent() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [hasBlurred, setHasBlurred] = useState(false);
  const [debouncedUrl, setDebouncedUrl] = useState("");
  const t = useTranslations("home");
  const isDesktop = useIsDesktop();
  const inputRef = useRef<HTMLInputElement>(null);
  const { isPremium, isLoading: isPremiumLoading } = useIsPremium();

  const { ad, fireImpression, fireClick } = useGravityAd({
    url: typeof window !== "undefined" ? window.location.href : "https://smry.ai",
    title: "smry - Read articles without paywalls",
    isPremium: isPremium || isPremiumLoading,
    prompt: "I want a very short, succinct ad",
  });

  const router = useRouter();

  // Debounce URL changes (400ms) - only validate after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUrl(url);
    }, 400);
    return () => clearTimeout(timer);
  }, [url]);

  // Compute validation error after debounce
  // Only show if: user has blurred OR input clearly looks like a URL attempt
  const debouncedError = useMemo(() => {
    if (!debouncedUrl.trim()) return null;
    if (!hasBlurred && !looksLikeUrlAttempt(debouncedUrl)) return null;
    return getValidationError(debouncedUrl);
  }, [debouncedUrl, hasBlurred]);

  const confidence = useMemo(() => {
    if (!debouncedUrl.trim()) return null;
    return getSiteConfidence(debouncedUrl);
  }, [debouncedUrl]);

  // Display either submit-triggered error or debounced error
  const displayError = urlError ?? debouncedError;

  // Focus input on desktop only (after hydration to avoid mobile keyboard popup)
  useEffect(() => {
    if (isDesktop) {
      inputRef.current?.focus();
    }
  }, [isDesktop]);

  // Global paste handler - allows pasting from anywhere on the page
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // If input is already focused, let the default behavior handle it
      if (document.activeElement === inputRef.current) return;

      const pastedText = e.clipboardData?.getData("text");
      if (pastedText) {
        setUrl(pastedText.trim());
        setUrlError(null);
        setHasBlurred(true); // Treat paste as committed input
        inputRef.current?.focus();
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  const handleBlur = useCallback(() => {
    if (url.trim()) {
      setHasBlurred(true);
    }
  }, [url]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUrl(newValue);
    // Clear submit-triggered error on change; debounced validation will re-evaluate
    if (urlError) setUrlError(null);
  }, [urlError]);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setHasBlurred(true); // Mark as committed on submit attempt

    try {
      const parsed = urlSchema.parse({ url });
      setUrlError(null);
      router.push(`/proxy?url=${encodeURIComponent(parsed.url)}`);
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? error.issues[0]?.message ?? t("validationError")
          : t("validationError");
      setUrlError(message);
    }
  };

  const isUrlValid = useMemo(() => {
    const { success } = urlSchema.safeParse({ url });
    return success;
  }, [url]);

  return (
    <>
      <PromoBanner />
      {/* <UpdateBanner /> */}
      <main className="relative flex min-h-[100dvh] sm:min-h-screen flex-col items-center bg-background px-6 pt-16 sm:pt-[22vh] text-foreground overflow-hidden">

        {/* Auth - top right */}
        <AuthBar className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6" />

        {/* Film grain texture - dark mode only */}
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.04] mix-blend-soft-light hidden dark:block"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>

        <div className="relative mx-auto flex flex-1 sm:flex-none w-full max-w-[528px] flex-col items-center justify-center sm:justify-start">
          {/* Wordmark - Syne for brand recognition */}
          <h1 className="font-syne text-5xl font-semibold tracking-tight text-foreground text-balance">
            smry
            <span className="sr-only"> - Bypass Paywalls & Read Full Articles Free</span>
          </h1>

          {/* Hero tagline */}
          <p className="mt-3 text-center text-[15px] text-muted-foreground/70">
            {t("tagline")}
          </p>

          {/* Input container - nested radius pattern */}
          <form onSubmit={handleSubmit} className="mt-6 w-full">
            <div
              className={clsx(
                "flex gap-1 p-1 rounded-[14px] transition-[background,box-shadow] duration-200",
                "bg-black/[0.03] dark:bg-white/[0.04]",
                "shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06),0_2px_4px_0_rgba(0,0,0,0.04)]",
                "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_1px_2px_-1px_rgba(0,0,0,0.2),0_2px_4px_0_rgba(0,0,0,0.15)]",
                "focus-within:bg-black/[0.04] dark:focus-within:bg-white/[0.06]",
                "focus-within:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.08),0_2px_4px_0_rgba(0,0,0,0.06)]",
                "dark:focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_1px_2px_-1px_rgba(0,0,0,0.25),0_2px_4px_0_rgba(0,0,0,0.2)]",
                displayError && "shadow-[0_0_0_1px_rgba(239,68,68,0.4),0_1px_2px_-1px_rgba(239,68,68,0.2),0_2px_4px_0_rgba(239,68,68,0.1)]"
              )}
            >
              <input
                ref={inputRef}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2 text-base placeholder:text-muted-foreground/50 focus:outline-none"
                name="url"
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                value={url}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="off"
                aria-invalid={Boolean(displayError)}
                aria-describedby={displayError ? "url-error" : undefined}
              />
              <button
                type="submit"
                aria-label={t("submitUrl")}
                disabled={!isUrlValid}
                className={clsx(
                  "flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-all duration-200",
                  isUrlValid
                    ? "bg-foreground text-background hover:bg-foreground/85 active:scale-95"
                    : url.length > 0
                      ? "text-foreground/40 pointer-events-none"
                      : "text-foreground/15 pointer-events-none"
                )}
              >
                <ArrowRight className="size-5" strokeWidth={isUrlValid ? 2 : 1.5} />
              </button>
            </div>
          </form>

          {displayError ? (
            <p id="url-error" className="mt-3 flex items-center text-sm text-destructive/70" role="alert">
              <ExclamationCircleIcon className="mr-1.5 size-4" />
              {displayError}
            </p>
          ) : confidence ? (
            <SiteConfidenceIndicator tier={confidence.tier} domain={confidence.domain} t={t} />
          ) : null}

          {/* Ad right below input — highest attention zone */}
          {!isPremium && !isPremiumLoading && ad && (
            <div className="mt-4 px-4 sm:px-0">
              <GravityAd
                ad={ad}
                variant="home"
                onVisible={() => fireImpression(ad)}
                onClick={() => fireClick(ad)}
              />
            </div>
          )}

          {/* Continue Reading card */}
          <ContinueReadingCard t={t} />

        </div>

        {/* Value prop */}
        <div className="mt-auto pt-4 sm:pt-8 mx-auto w-full max-w-[400px] px-2 sm:px-6">
          <div className="rounded-xl sm:rounded-2xl border border-border/30 bg-card/40 px-4 py-3.5 sm:px-6 sm:py-5 backdrop-blur-sm">
            <h2 className="text-center text-[14px] sm:text-[15px] font-medium text-foreground/80">
              {t("valuePropTitle")}
            </h2>
            <p className="mt-2 text-balance text-center text-[12px] sm:text-[13px] leading-relaxed text-muted-foreground/60">
              {t("valuePropDescription")}
            </p>
            <div className="mt-3 sm:mt-4 flex justify-center">
              <Link
                href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
                className="group inline-flex items-center gap-1 rounded-full bg-foreground/[0.03] px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <span>{t("tryPaywalledArticle")}</span>
                <ArrowRight className="size-2.5 sm:size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="mt-2 pb-4 sm:mt-4 sm:pb-6 mx-auto flex w-fit flex-col items-center">
          <button
            onClick={() => {
              document.getElementById("below-fold")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-0.5 text-muted-foreground/30 transition-colors hover:text-muted-foreground/50"
            aria-label={t("scrollToLearnMore")}
          >
            <span className="text-[10px] sm:text-xs">{t("learnMore")}</span>
            <ChevronDown className="size-3 sm:size-4" />
          </button>
        </div>
      </main>

      {/* Below the fold */}
      <section id="below-fold">
        {/* Features Grid */}
        <div className="mx-auto max-w-[960px] px-5 py-12">
          <div className="flex flex-col gap-4 lg:gap-0 lg:grid lg:grid-cols-2">
            {/* Row 1: Desktop = Visual left, Text right. Mobile = Text first */}
            <FeatureText
              title={t("featureSourcesTitle")}
              description={t("featureSourcesDescription")}
              className="order-1 lg:order-2"
            />
            <FeatureVisual className="order-2 lg:order-1">
              <SourceFetchCard t={t} />
            </FeatureVisual>

            {/* Row 2: Desktop = Text left, Visual right. Mobile = Text first */}
            <FeatureText
              title={t("featureCleanTitle")}
              description={t("featureCleanDescription")}
              className="order-3 lg:order-3"
            />
            <FeatureVisual className="order-4 lg:order-4">
              <CleanReadingCard t={t} />
            </FeatureVisual>

            {/* Row 3: Desktop = Visual left, Text right. Mobile = Text first */}
            <FeatureText
              title={t("featureSummaryTitle")}
              description={t("featureSummaryDescription")}
              className="order-5 lg:order-6"
            />
            <FeatureVisual className="order-6 lg:order-5">
              <AISummaryCard t={t} />
            </FeatureVisual>
          </div>
        </div>

        {/* FAQ */}
        <div className="border-t border-border/30 px-6 py-16">
          <div className="mx-auto max-w-xl">
            <FAQ />
          </div>
        </div>
      </section>

      <Footer />
      <BottomCornerNav />
    </>
  );
});
