"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { changelog } from "@/lib/changelog";

export function ChangelogContent() {
  const t = useTranslations("changelog");

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {t("backToSmry")}
          </Link>
          <Link href="/">
            <Image
              src="/logo.svg"
              width={64}
              height={20}
              alt="smry"
              className="dark:invert"
            />
          </Link>
          <div className="w-16" />
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-16">
        <header className="mb-12">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("description")}</p>
        </header>

        {/* Premium highlight */}
        <div className="mb-12 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Pro features
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300/80">
            Premium AI models, unlimited summaries, bypass indicators, and unlimited history.{" "}
            <Link href="/pricing" className="underline underline-offset-2">
              Upgrade
            </Link>
          </p>
        </div>

        <div className="space-y-12">
          {changelog.map((entry, i) => (
            <section key={i}>
              <time className="text-sm font-medium text-muted-foreground">{entry.date}</time>
              <ul className="mt-4 space-y-4">
                {entry.changes.map((change, j) => (
                  <li key={j}>
                    <div>
                      <p className="text-[15px] leading-relaxed">
                        <span className="font-medium">{change.text}</span>
                        {change.premium && (
                          <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            Pro
                          </span>
                        )}
                      </p>
                      {change.detail && (
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                          {change.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-16 border-t border-border/50 pt-8">
          <p className="text-sm text-muted-foreground">
            {t("footerNote")}{" "}
            <a
              href="https://github.com/mrmps/SMRY"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
