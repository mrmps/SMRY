"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
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
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground overflow-hidden">
        {/* Subtle ambient glow */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-foreground/[0.02] rounded-full blur-3xl" />

        <div className="z-10 mx-auto flex w-full max-w-md flex-col items-center justify-center">
          {/* Wordmark */}
          <h1 className="font-syne text-[2.75rem] font-normal tracking-normal text-foreground">
            smry
          </h1>

          {/* Tagline - softer color for hierarchy */}
          <p className="mt-2 text-center text-base text-muted-foreground/70">
            {t("tagline")}{" "}
            <Link
              href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
              className="text-foreground/80 underline underline-offset-4 decoration-foreground/30 transition-colors hover:text-foreground hover:decoration-foreground/60"
            >
              {t("tryIt")}
            </Link>
          </p>

          {/* Input */}
          <form onSubmit={handleSubmit} className="mt-4 w-full">
            <div
              className={clsx(
                "flex overflow-hidden rounded-lg border transition-all duration-200",
                "bg-muted/30",
                "focus-within:bg-muted/50 focus-within:border-foreground/20",
                urlError ? "border-destructive/50" : "border-foreground/[0.08]"
              )}
            >
              <input
                className="w-full bg-transparent px-4 py-3 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none"
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
                className="rounded-none border-0 px-3 transition-all duration-200 hover:bg-transparent"
                type="submit"
                variant="ghost"
                aria-label={t("submitUrl")}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className={clsx(
                    "size-5 transition-all duration-200",
                    isHovered && "translate-x-0.5",
                    isUrlValid ? "text-foreground/70" : "text-muted-foreground/40"
                  )}
                />
              </Button>
            </div>
          </form>

          {urlError && (
            <p
              className="animate-fade-in mt-2 flex items-center text-sm text-destructive/70"
              role="alert"
            >
              <ExclamationCircleIcon className="mr-1.5 size-4" />
              {urlError}
            </p>
          )}

          {/* Subtle hint */}
          <p className="mt-3 text-xs text-muted-foreground/40">
            or prepend <code className="text-muted-foreground/50">smry.ai/</code> to any URL
          </p>
        </div>
      </main>

      <BottomCornerNav />
    </>
  );
}
