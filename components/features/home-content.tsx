"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import clsx from "clsx";
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

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground">
        <div className="mx-auto flex w-full max-w-[528px] flex-col items-center">
          {/* Title - bold, simple */}
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
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

          {/* Description - below input */}
          <p className="mt-6 text-center text-sm text-muted-foreground/70">
            {t("tagline")}{" "}
            <Link
              href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
              className="text-muted-foreground underline underline-offset-4 decoration-muted-foreground/40 transition-colors hover:text-foreground"
            >
              {t("tryIt")}
            </Link>
          </p>
        </div>
      </main>

      <BottomCornerNav />
    </>
  );
}
