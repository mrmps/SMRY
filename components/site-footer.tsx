import * as React from "react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/app/config/site";
import Image from "next/image";

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  return (
    <footer className={cn(className)}>
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
        <Image
            src="/logo.svg"
            width={100}
            height={100}
            alt={"smry logo"}
            className="-mb-1"
          />
          <p className="text-center text-sm leading-loose md:text-left">
            Built by{" "}
            <a
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              michael_chomsky
            </a>
            . Hosted on{" "}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Vercel
            </a>
            . The source code is available on{" "}
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
        <div className="flex flex-col items-center gap-2 md:flex-row md:gap-4">
          <p className="text-center text-sm leading-loose md:text-left">
            <a
              href="/feedback"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              feedback
            </a>
          </p>
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 leading-loose md:text-left">
            <a
              href="https://logokit.com"
              target="_blank"
              rel="noreferrer"
              title="Logo API"
              className="hover:text-zinc-500 dark:hover:text-zinc-500"
            >
              Logos by LogoKit.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
