"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
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
import { BookmarkletLink } from "@/components/marketing/bookmarklet";
import { FAQ } from "@/components/marketing/faq";

// Empty subscribe function for useSyncExternalStore
const emptySubscribe = () => () => {};

// Feature Grid Cell - visual card with rounded background
function FeatureVisual({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[340px] items-center justify-center rounded-2xl bg-[#f5f5f5] dark:bg-[#111]">
      {children}
    </div>
  );
}

// Feature Grid Cell - text content
function FeatureText({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-[340px] flex-col items-center justify-center gap-2.5 px-6 text-center">
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
function SourceFetchCard() {
  return (
    <div className="relative flex max-w-[320px] flex-col gap-3">
      {/* Vertical timeline line */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* Badge */}
      <div className="relative z-10 flex justify-center">
        <div className="flex items-center justify-center rounded-full bg-white/80 px-2.5 py-1 text-sm font-medium text-[#999] backdrop-blur-sm dark:bg-[#222]/80 dark:text-[#888]">
          Fetching
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 flex w-[320px] flex-col gap-0.5 overflow-hidden rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:bg-[#222] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-center px-2 py-1.5">
          <p className="text-xs text-[#999] dark:text-[#777]">
            Racing <span className="text-[#181925] dark:text-white">3 sources</span> simultaneously
          </p>
        </div>

        <div className="flex flex-col gap-[1.5px] overflow-hidden">
          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">Wayback Machine</span>
              </div>
              <span className="text-[13px] text-emerald-500">Winner</span>
            </div>
          </div>

          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <Loader2 className="h-4 w-4 shrink-0 text-[#999] dark:text-[#777]" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">Jina.ai</span>
              </div>
              <span className="text-[13px] text-[#999] dark:text-[#777]">Cancelled</span>
            </div>
          </div>

          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <Ban className="h-4 w-4 shrink-0 text-[#999] dark:text-[#777]" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">Direct Access</span>
              </div>
              <span className="text-[13px] text-[#999] dark:text-[#777]">Paywalled</span>
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
function CleanReadingCard() {
  return (
    <div className="relative flex max-w-[320px] flex-col gap-3">
      {/* Vertical timeline line */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* Badge */}
      <div className="relative z-10 flex justify-center">
        <div className="flex items-center justify-center rounded-full bg-white/80 px-2.5 py-1 text-sm font-medium text-[#999] backdrop-blur-sm dark:bg-[#222]/80 dark:text-[#888]">
          Clean Mode
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 flex w-[320px] flex-col gap-0.5 overflow-hidden rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:bg-[#222] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-center px-2 py-1.5">
          <p className="text-xs text-[#999] dark:text-[#777]">
            Removed <span className="text-[#181925] dark:text-white">12 distractions</span>
          </p>
        </div>

        <div className="flex flex-col gap-[1.5px] overflow-hidden">
          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">Paywall overlay</span>
              </div>
              <span className="text-[13px] text-red-400">Removed</span>
            </div>
          </div>

          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">Cookie banner</span>
              </div>
              <span className="text-[13px] text-red-400">Removed</span>
            </div>
          </div>

          <div className="rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a]">
            <div className="flex h-9 items-center justify-between gap-2 px-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <X className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
                <span className="truncate text-sm text-[#181925] dark:text-white">Sidebar ads (3)</span>
              </div>
              <span className="text-[13px] text-red-400">Removed</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-2">
          <div className="flex items-center gap-1.5 text-sm text-[#999] dark:text-[#777]">
            <CheckCircle className="h-4 w-4" strokeWidth={2} />
            <span>Ready to read</span>
          </div>
          <span className="text-[13px] text-emerald-500">2,847 words</span>
        </div>
      </div>
    </div>
  );
}

// AI Summary Card Visual
function AISummaryCard() {
  return (
    <div className="w-[280px] overflow-hidden rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:bg-[#222] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="text-xs font-medium text-[#999] dark:text-[#777]">Summary</span>
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
function useIsDesktop() {
  return useSyncExternalStore(
    emptySubscribe,
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true // Assume desktop on server
  );
}

const urlSchema = z.object({
  url: NormalizedUrlSchema,
});

export function HomeContent() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const t = useTranslations("home");
  const isDesktop = useIsDesktop();

  const router = useRouter();

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

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
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-72 text-foreground overflow-hidden">

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
                "flex gap-1 p-1 rounded-[14px] border transition-all duration-200",
                "bg-foreground/[0.045]",
                "focus-within:bg-foreground/[0.06] focus-within:border-foreground/20",
                urlError ? "border-destructive/50" : "border-foreground/[0.15]"
              )}
            >
              <input
                className="min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2 text-base placeholder:text-muted-foreground/50 focus:outline-none"
                name="url"
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                autoFocus={isDesktop}
                autoComplete="off"
                aria-invalid={Boolean(urlError)}
              />
              <button
                type="submit"
                aria-label={t("submitUrl")}
                disabled={!isUrlValid}
                className={clsx(
                  "flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-all duration-200",
                  isUrlValid
                    ? "text-foreground/90 hover:bg-foreground/10"
                    : "text-foreground/50 pointer-events-none"
                )}
              >
                <ArrowRight className="size-5" strokeWidth={1.5} />
              </button>
            </div>
          </form>

          {urlError && (
            <p className="mt-3 flex items-center text-sm text-destructive/70" role="alert">
              <ExclamationCircleIcon className="mr-1.5 size-4" />
              {urlError}
            </p>
          )}

          {/* Value prop - below input */}
          <p className="mt-5 text-sm text-muted-foreground/60">
            Unlock any article. Read or summarize it.{" "}
            <Link
              href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
              className="text-muted-foreground/80 underline underline-offset-4 decoration-muted-foreground/30 transition-colors hover:text-foreground"
            >
              Try it
            </Link>
          </p>
        </div>

        {/* Scroll indicator + Bookmarklet */}
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-6">
          <BookmarkletLink />
          <button
            onClick={() => {
              document.getElementById("below-fold")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground/60"
            aria-label="Scroll to learn more"
          >
            <span className="text-xs">Learn more</span>
            <ChevronDown className="size-4" />
          </button>
        </div>
      </main>

      {/* Below the fold */}
      <section id="below-fold">
        {/* Features Grid */}
        <div className="mx-auto max-w-[960px] px-5 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Row 1: Visual left, Text right */}
            <FeatureVisual>
              <SourceFetchCard />
            </FeatureVisual>
            <FeatureText
              title="Three sources race, the fastest wins"
              description="We fetch from Wayback Machine, Jina.ai, and direct access simultaneously. First one with the article wins."
            />

            {/* Row 2: Text left, Visual right */}
            <FeatureText
              title="All the content, none of the clutter"
              description="Paywalls, popups, cookie banners, ads—all gone. Just the article text and images, ready to read."
            />
            <FeatureVisual>
              <CleanReadingCard />
            </FeatureVisual>

            {/* Row 3: Visual left, Text right */}
            <FeatureVisual>
              <AISummaryCard />
            </FeatureVisual>
            <FeatureText
              title="TL;DR in your language"
              description="AI-powered summaries in 8 languages. Get the key points without reading the full article."
            />
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
