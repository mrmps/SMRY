"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import {
  ArrowRight,
  ChevronDown,
  Check,
  X,
  Ban,
  Loader2,
  CheckCircle,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import clsx from "clsx";
import { NormalizedUrlSchema } from "@/lib/validation/url";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BottomCornerNav } from "@/components/shared/bottom-corner-nav";
import { FAQ } from "@/components/marketing/faq";
import { AuthBar } from "@/components/shared/auth-bar";

// Empty subscribe function for useSyncExternalStore
const emptySubscribe = () => () => {};


// Feature Grid Cell - visual card with rounded background
function FeatureVisual({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx(
      "relative flex h-[280px] sm:h-[320px] lg:h-[340px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#f8f8f8] via-[#f3f3f3] to-[#eee] dark:from-[#161616] dark:via-[#131313] dark:to-[#0f0f0f]",
      className
    )}>
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent dark:from-white/[0.03]" />
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
      <h2 className="max-w-[300px] text-lg font-medium leading-6 tracking-[-0.2px] text-foreground">
        {title}
      </h2>
      <p className="max-w-[300px] text-[14px] leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// Source Fetching Card Visual
function SourceFetchCard({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  return (
    <div className="relative flex max-w-[320px] flex-col gap-3">
      {/* Vertical timeline line */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* Badge */}
      <div className="relative z-10 flex justify-center">
        <div className="flex items-center justify-center rounded-full bg-white/80 px-2.5 py-1 text-sm font-medium text-[#999] backdrop-blur-sm dark:bg-[#222]/80 dark:text-[#888]">
          {t("fetchingBadge")}
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 flex w-[320px] flex-col gap-0.5 overflow-hidden rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:bg-[#222] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-center px-2 py-1.5">
          <p className="text-xs text-[#999] dark:text-[#777]">
            {t("racingSources", { count: 3 })}
          </p>
        </div>

        <div className="flex flex-col gap-[1.5px] overflow-hidden">
          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">{t("sourceWayback")}</span>
              </div>
              <span className="text-[13px] text-emerald-500">{t("statusWinner")}</span>
            </div>
          </div>

          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <Loader2 className="h-4 w-4 shrink-0 text-[#999] dark:text-[#777]" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">{t("sourceJina")}</span>
              </div>
              <span className="text-[13px] text-[#999] dark:text-[#777]">{t("statusCancelled")}</span>
            </div>
          </div>

          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <Ban className="h-4 w-4 shrink-0 text-[#999] dark:text-[#777]" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">{t("sourceDirect")}</span>
              </div>
              <span className="text-[13px] text-[#999] dark:text-[#777]">{t("statusPaywalled")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-2">
          <div className="flex items-center gap-1.5 text-sm text-[#999] dark:text-[#777]">
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            <span className="truncate">nytimes.com/article</span>
          </div>
          <span className="text-[13px] text-[#999] dark:text-[#777]">0.8s</span>
        </div>
      </div>
    </div>
  );
}

// Clean Reading Card Visual
function CleanReadingCard({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  return (
    <div className="relative flex max-w-[320px] flex-col gap-3">
      {/* Vertical timeline line */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* Badge */}
      <div className="relative z-10 flex justify-center">
        <div className="flex items-center justify-center rounded-full bg-white/80 px-2.5 py-1 text-sm font-medium text-[#999] backdrop-blur-sm dark:bg-[#222]/80 dark:text-[#888]">
          {t("cleanModeBadge")}
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 flex w-[320px] flex-col gap-0.5 overflow-hidden rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:bg-[#222] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-center px-2 py-1.5">
          <p className="text-xs text-[#999] dark:text-[#777]">
            {t("removedDistractions", { count: 12 })}
          </p>
        </div>

        <div className="flex flex-col gap-[1.5px] overflow-hidden">
          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">{t("paywallOverlay")}</span>
              </div>
              <span className="text-[13px] text-red-400">{t("statusRemoved")}</span>
            </div>
          </div>

          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">{t("cookieBanner")}</span>
              </div>
              <span className="text-[13px] text-red-400">{t("statusRemoved")}</span>
            </div>
          </div>

          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">{t("sidebarAds", { count: 3 })}</span>
              </div>
              <span className="text-[13px] text-red-400">{t("statusRemoved")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-2">
          <div className="flex items-center gap-1.5 text-sm text-[#999] dark:text-[#777]">
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
    <div className="w-[280px] overflow-hidden rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:bg-[#222] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="text-xs font-medium text-[#999] dark:text-[#777]">{t("summaryLabel")}</span>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-full rounded-full bg-[#f0f0f0] dark:bg-[#333]" />
        <div className="h-2.5 w-[90%] rounded-full bg-[#f0f0f0] dark:bg-[#333]" />
        <div className="h-2.5 w-[95%] rounded-full bg-[#f0f0f0] dark:bg-[#333]" />
        <div className="h-2.5 w-[70%] rounded-full bg-[#f0f0f0] dark:bg-[#333]" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["EN", "DE", "ES", "FR", "PT", "NL", "ZH", "JA"].map((lang) => (
          <span
            key={lang}
            className={clsx(
              "rounded-md px-2 py-0.5 text-[10px] font-medium",
              lang === "EN"
                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-[#f0f0f0] text-[#999] dark:bg-[#333] dark:text-[#777]"
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
    () => true // Assume desktop on server
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
  return /\.[a-zA-Z]{2,}/.test(trimmed) || /^https?:\/\//i.test(trimmed);
}

export function HomeContent() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [hasBlurred, setHasBlurred] = useState(false);
  const [debouncedUrl, setDebouncedUrl] = useState("");
  const t = useTranslations("home");
  const isDesktop = useIsDesktop();
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Display either submit-triggered error or debounced error
  const displayError = urlError ?? debouncedError;

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
      <main className="relative flex min-h-screen flex-col items-center bg-background px-6 pt-[22vh] text-foreground overflow-hidden">

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

        <div className="relative mx-auto flex w-full max-w-[528px] flex-col items-center">
          {/* Wordmark - Syne for brand recognition */}
          <h1 className="font-syne text-5xl font-semibold tracking-tight text-foreground">
            smry
          </h1>

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
                autoFocus={isDesktop}
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

          {displayError && (
            <p id="url-error" className="mt-3 flex items-center text-sm text-destructive/70" role="alert">
              <ExclamationCircleIcon className="mr-1.5 size-4" />
              {displayError}
            </p>
          )}

        </div>

        {/* Value prop - positioned near bottom */}
        <div className="absolute bottom-56 left-1/2 w-full max-w-[400px] -translate-x-1/2 px-6">
          <div className="rounded-2xl border border-border/40 bg-card/50 px-6 py-5 backdrop-blur-sm">
            <h2 className="text-center text-[15px] font-medium text-foreground/90">
              {t("valuePropTitle")}
            </h2>
            <p className="mt-2.5 text-center text-[13px] leading-relaxed text-muted-foreground/70">
              {t("valuePropDescription")}
            </p>
            <div className="mt-4 flex justify-center">
              <Link
                href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
                className="group inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.03] px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <span>{t("tryPaywalledArticle")}</span>
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <button
            onClick={() => {
              document.getElementById("below-fold")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground/60"
            aria-label={t("scrollToLearnMore")}
          >
            <span className="text-xs">{t("learnMore")}</span>
            <ChevronDown className="size-4" />
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

      <BottomCornerNav />
    </>
  );
}
