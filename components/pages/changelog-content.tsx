"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";

type ChangeType = "new" | "fix" | "improved";

interface Change {
  type: ChangeType;
  text: string;
  detail?: string;
  premium?: boolean;
}

interface ChangelogEntry {
  date: string;
  changes: Change[];
}

const TYPE_STYLES: Record<ChangeType, string> = {
  new: "bg-emerald-500",
  fix: "bg-orange-500",
  improved: "bg-blue-500",
};

const changelog: ChangelogEntry[] = [
  {
    date: "Jan 11, 2025",
    changes: [
      {
        type: "new",
        text: "Premium AI summaries",
        detail: "Premium users now get summaries powered by Claude 3.5 Haiku, Gemini 3 Flash, and GPT-5 Mini — higher quality and more accurate than free-tier models.",
        premium: true,
      },
      { type: "new", text: "Changelog page" },
    ],
  },
  {
    date: "Jan 10, 2025",
    changes: [
      {
        type: "new",
        text: "Bypass status indicator",
        detail: "See whether each source successfully retrieved the full article, got partial content, or was blocked.",
        premium: true,
      },
    ],
  },
  {
    date: "Dec 15, 2024",
    changes: [
      {
        type: "new",
        text: "Multi-language support",
        detail: "SMRY is now available in English, Spanish, German, Portuguese, Dutch, and Chinese.",
      },
      {
        type: "new",
        text: "Reading history",
        detail: "Track and search through your reading history. Pro users get unlimited history with full-text search.",
        premium: true,
      },
    ],
  },
  {
    date: "Dec 1, 2024",
    changes: [
      {
        type: "improved",
        text: "Parallel source fetching",
        detail: "Articles are now fetched from multiple sources simultaneously, reducing load times and improving bypass success rates.",
      },
    ],
  },
  {
    date: "Nov 20, 2024",
    changes: [
      {
        type: "new",
        text: "AI summaries",
        detail: "Get AI-generated summaries of any article in seconds, available in 8 languages. Premium users get unlimited summaries.",
        premium: true,
      },
      {
        type: "new",
        text: "Copy to LLMs",
        detail: "One-click copy articles as clean markdown for ChatGPT, Claude, or other AI assistants.",
      },
    ],
  },
  {
    date: "Nov 10, 2024",
    changes: [
      {
        type: "fix",
        text: "Improved paywall detection",
        detail: "Better handling of soft paywalls that use JavaScript to hide content after page load.",
      },
    ],
  },
];

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
                  <li key={j} className="flex items-start gap-3">
                    <span
                      className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_STYLES[change.type]}`}
                    />
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
