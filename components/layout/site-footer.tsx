"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/app/config/site";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  const t = useTranslations("footer");
  const tCommon = useTranslations("common");

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
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-center md:flex-row md:justify-end md:gap-4 md:text-right">
          <a
            href="https://smryai.userjot.com/"
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline" size="sm">
              {t("reportBug")}
            </Button>
          </a>
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 md:text-right">
            <a
              href="https://logo.dev"
              target="_blank"
              rel="noreferrer"
              title="Logo API"
              className="hover:text-zinc-500 dark:hover:text-zinc-500"
            >
              {t("logosBy")}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
