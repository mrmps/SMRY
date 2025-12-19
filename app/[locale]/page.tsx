"use client";

import { useMemo, useState } from "react";
import {
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { CornerDownLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { z } from "zod";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { GitHubStarsButton } from "@/components/ui/shadcn-io/github-stars-button";
import { Banner } from "@/components/marketing/banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { BookmarkletLink } from "@/components/marketing/bookmarklet";
import { AdSpot } from "@/components/marketing/ad-spot";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { FAQ } from "@/components/marketing/faq";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { NormalizedUrlSchema } from "@/lib/validation/url";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

const urlSchema = z.object({
  url: NormalizedUrlSchema,
});

const ModeToggle = dynamic(
  () => import("@/components/shared/mode-toggle").then((mod) => mod.ModeToggle),
  { ssr: false, loading: () => <div className="size-9" /> }
);

// Shows "Support" link only for non-premium signed-in users
function SupportLink() {
  const { isPremium, isLoading } = useIsPremium();
  const t = useTranslations("home");

  // Don't show while loading to prevent flash
  if (isLoading) return null;

  // Don't show for premium users (they're already supporters!)
  if (isPremium) return null;

  return (
    <Link
      href="/pricing"
      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {t("support")} ♡
    </Link>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

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
      console.error(error);
    }
  };

  const isUrlValid = useMemo(() => {
    const { success } = urlSchema.safeParse({ url });
    return success;
  }, [url]);

  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div className="absolute right-4 top-4 z-50 flex items-center gap-3 md:right-8 md:top-8">
        <SignedIn>
          <SupportLink />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-9"
              }
            }}
          />
        </SignedIn>
        <SignedOut>
          <Link
            href="/pricing"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("support")} ♡
          </Link>
        </SignedOut>
        <LanguageSwitcher />
        <ModeToggle />
      </div>

      <AdSpot className="lg:fixed lg:left-6 lg:top-6 lg:z-40" />

      <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-20 text-foreground sm:pt-24 md:p-24 pb-24 lg:pb-4">
        <div className="z-10 mx-auto flex w-full max-w-lg flex-col items-center justify-center sm:mt-16">
          <GitHubStarsButton
            username="mrmps"
            repo="SMRY"
            formatted={true}
            className="mb-10 mr-4"
          />
          <h1 className="text-center text-4xl font-semibold text-foreground md:text-5xl">
            <Image
              src="/logo.svg"
              width={280}
              height={280}
              alt={tCommon("smryLogo")}
              className="-ml-4 dark:invert"
              priority
            />
          </h1>

          <p className="mt-2 text-center text-lg text-muted-foreground">
            {t("tagline")}{" "}
            <Link
              href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
              className="border-b border-muted-foreground transition-colors hover:text-foreground hover:border-foreground"
            >
              {t("tryIt")}
            </Link>
            .
          </p>

          <form onSubmit={handleSubmit} className="mt-6 w-full">
            <div className={clsx(
              "flex overflow-hidden rounded-lg border shadow-sm transition-all duration-300",
              "bg-background",
              "focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-200 focus-within:ring-offset-0",
              urlError ? "border-red-500 ring-red-200" : "border-input"
            )}>
              <input
                className="w-full bg-transparent p-4 py-3 text-lg placeholder:text-muted-foreground focus:outline-none"
                name="url"
                placeholder={t("placeholder")}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                autoFocus
                autoComplete="off"
                aria-invalid={Boolean(urlError)}
              />
              <Button
                className="rounded-none border-0 px-4 font-mono transition-all duration-300 ease-in-out hover:bg-transparent"
                type="submit"
                variant="ghost"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div className="hidden sm:block">
                  <CornerDownLeft
                    className={clsx(
                      "size-5 transition-transform duration-300 ease-in-out",
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
                    className={clsx(
                      "size-6 transition-transform duration-300 ease-in-out",
                      {
                        "text-foreground scale-110": isHovered,
                        "text-purple-500": isUrlValid,
                        "text-muted-foreground": !isUrlValid,
                      }
                    )}
                  />
                </div>
              </Button>
            </div>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("by")}{" "}
            <a
              href="https://x.com/michael_chomsky"
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-muted-foreground transition-colors hover:text-foreground"
            >
              @michael_chomsky
            </a>
          </p>

          {urlError && (
            <p
              className="animate-fade-in mt-2 flex items-center text-muted-foreground"
              role="alert"
            >
              <ExclamationCircleIcon className="mr-2 size-5 text-muted-foreground" />
              {urlError}
            </p>
          )}

          <div className="mx-auto mt-12 max-w-2xl space-y-4 text-center">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {t("prepend")}{" "}
              <code className="rounded bg-yellow-200 px-2 py-0.5 font-mono text-xs text-stone-700 dark:bg-yellow-900 dark:text-stone-200">
                https://smry.ai/
              </code>{" "}
              {t("toAnyUrl")}
            </p>

            <div className="hidden border-t border-border pt-2 sm:block">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("bookmarkletTip")} <BookmarkletLink />. {t("bookmarkletInstructions")}
              </p>
            </div>
          </div>
        </div>

        <Banner />
        <FAQ />
      </main>

      <div className="bg-background">
        <SiteFooter className="border-t border-border" />
      </div>
    </>
  );
}
