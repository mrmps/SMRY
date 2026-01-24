"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { CornerDownLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { BookmarkletLink } from "@/components/marketing/bookmarklet";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { NormalizedUrlSchema } from "@/lib/validation/url";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BottomCornerNav } from "@/components/shared/bottom-corner-nav";

// Empty subscribe function for useSyncExternalStore
const emptySubscribe = () => () => {};

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

  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
        <div className="z-10 mx-auto flex w-full max-w-xl flex-col items-center justify-center">
          {/* Wordmark */}
          <h1 className="font-syne text-[2.75rem] font-normal tracking-normal text-foreground">
            smry
          </h1>

          {/* Tagline - softer color for hierarchy */}
          <p className="mt-4 text-center text-lg text-muted-foreground/80">
            {t("tagline")}{" "}
            <Link
              href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
              className="text-muted-foreground underline underline-offset-4 decoration-muted-foreground/40 transition-colors hover:text-foreground hover:decoration-foreground"
            >
              {t("tryIt")}
            </Link>.
          </p>

          {/* Input */}
          <form onSubmit={handleSubmit} className="mt-8 w-full">
            <div
              className={clsx(
                "flex overflow-hidden rounded-xl border transition-colors duration-300",
                "bg-background",
                "focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/20 focus-within:ring-offset-0",
                urlError ? "border-destructive ring-destructive/20" : "border-input"
              )}
            >
              <input
                className="w-full bg-transparent px-5 py-4 text-base placeholder:text-muted-foreground/70 focus:outline-none md:text-lg"
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
              <Button
                className="rounded-none border-0 px-4 font-mono transition-colors duration-300 ease-in-out hover:bg-transparent"
                type="submit"
                variant="ghost"
                aria-label={t("submitUrl")}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div className="hidden sm:block">
                  <CornerDownLeft
                    aria-hidden="true"
                    className={clsx(
                      "size-5 transition-transform duration-300 ease-in-out motion-reduce:transition-none",
                      {
                        "text-foreground scale-110": isHovered,
                        "text-foreground/80": isUrlValid,
                        "text-muted-foreground": !isUrlValid,
                      }
                    )}
                  />
                </div>
                <div className="sm:hidden">
                  <PaperAirplaneIcon
                    aria-hidden="true"
                    className={clsx(
                      "size-6 transition-transform duration-300 ease-in-out motion-reduce:transition-none",
                      {
                        "text-foreground scale-110": isHovered,
                        "text-foreground/80": isUrlValid,
                        "text-muted-foreground": !isUrlValid,
                      }
                    )}
                  />
                </div>
              </Button>
            </div>
          </form>

          {urlError && (
            <p
              className="animate-fade-in mt-3 flex items-center text-sm text-destructive/80"
              role="alert"
            >
              <ExclamationCircleIcon className="mr-2 size-4" />
              {urlError}
            </p>
          )}

          {/* Tips section */}
          <details className="relative mx-auto mt-8 w-full max-w-lg group [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-center gap-2 text-sm text-muted-foreground/50 transition-colors hover:text-muted-foreground/70 group-open:text-muted-foreground/70">
              <span>{t("quickAccessTips")}</span>
              <svg
                className="size-3 transition-transform duration-200 ease-out group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 md:absolute md:top-full md:left-0 md:right-0 md:mt-6">
              {/* Prepend tip */}
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
                <svg className="size-4 shrink-0 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <p className="text-sm text-muted-foreground">
                  {t.rich("prependTip", {
                    code: (chunks) => (
                      <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                        {chunks}
                      </code>
                    ),
                  })}
                </p>
              </div>

              {/* Bookmarklet tip */}
              <div className="hidden sm:flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
                <svg className="size-4 shrink-0 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                <p className="flex-1 text-sm text-muted-foreground">
                  {t("dragToBookmarks")}
                </p>
                <BookmarkletLink />
              </div>
            </div>
          </details>
        </div>
      </main>

      <BottomCornerNav />
    </>
  );
}
