"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/app/config/site";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

function useGitHubStars(username: string, repo: string) {
  return useQuery({
    queryKey: ["github-stars", username, repo],
    queryFn: async () => {
      const cached = localStorage.getItem(`github-stars-${username}-${repo}`);
      if (cached) {
        const { stars, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 1000 * 60 * 60 * 24 * 5) return stars;
      }
      const res = await fetch(`https://api.github.com/repos/${username}/${repo}`);
      const data = await res.json();
      const count = data.stargazers_count as number;
      localStorage.setItem(
        `github-stars-${username}-${repo}`,
        JSON.stringify({ stars: count, timestamp: Date.now() })
      );
      return count;
    },
    staleTime: 1000 * 60 * 60 * 24 * 5,
    gcTime: 1000 * 60 * 60 * 24 * 5,
  });
}

function formatStars(num: number): string {
  if (num < 1000) return num.toString();
  return (num / 1000).toFixed(1) + "k";
}

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  const t = useTranslations("footer");
  const tCommon = useTranslations("common");
  const { data: stars } = useGitHubStars("mrmps", "SMRY");

  return (
    <footer className={cn(className)}>
      <div className="container mb-10 flex flex-col items-center gap-6 py-10 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8 md:py-6">
        <div className="flex flex-col items-center gap-3 text-center md:flex-row md:items-center md:gap-4 md:text-left">
          <Image
            src="/logo.svg"
            width={100}
            height={30}
            alt={tCommon("smryLogo")}
            className="-mb-1 dark:invert md:ml-10"
          />
          <p className="text-center text-sm md:text-left">
            {t("builtBy")}{" "}
            <a
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              michael_chomsky
            </a>
            . {t("hostedOn")}{" "}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Vercel
            </a>
            . {t("sourceCode")}{" "}
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
            >
              GitHub
              {stars && (
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground no-underline">
                  <Star className="size-3 fill-yellow-500 text-yellow-500" />
                  {formatStars(stars)}
                </span>
              )}
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-center md:flex-row md:justify-end md:gap-4 md:text-right">
          <Link href="/changelog">
            <Button variant="ghost" size="sm">
              {t("changelog")}
            </Button>
          </Link>
          <a
            href="https://smryai.userjot.com/"
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline" size="sm">
              {t("reportBug")}
            </Button>
          </a>
          <p className="text-center text-xs text-foreground-faint md:text-right">
            <a
              href="https://logo.dev"
              target="_blank"
              rel="noreferrer"
              title="Logo API"
              className="hover:text-foreground-muted"
            >
              {t("logosBy")}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
