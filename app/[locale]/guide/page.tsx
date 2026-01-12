import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-static';

export const metadata = {
  title: "Paywall Bypass Guide | SMRY",
  description: "An honest guide to bypassing paywalls. What works, what doesn't, and what to try when SMRY can't get your article.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

const methods = [
  {
    name: "archive.is",
    tag: "Most effective",
    tagColor: "emerald",
    description: "Archive.is (also archive.today, archive.ph) doesn't respect robots.txt, so it can archive content that we can't access.",
    code: "https://archive.is/newest/[your-url]",
    note: "If no archive exists, you can request one — takes a few minutes.",
  },
  {
    name: "Wayback Machine",
    description: "Browse archive.org directly for older snapshots. Sometimes works when our automated fetch doesn't.",
    code: "https://web.archive.org/web/*/[your-url]",
    note: "Check the calendar for different dates. Older archives may have full content.",
  },
  {
    name: "Incognito mode",
    tag: "Metered only",
    tagColor: "muted",
    description: "Some sites track free articles using cookies. A private window resets the counter.",
    note: "Only works for metered paywalls — won't help with hard paywalls.",
  },
];

export default async function GuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to SMRY
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
          <h1 className="text-2xl font-semibold tracking-tight">Paywall Bypass Guide</h1>
          <p className="mt-2 text-muted-foreground">
            An honest guide to what works, what doesn&apos;t, and what to try when you can&apos;t access an article.
          </p>
        </header>

        {/* How SMRY Works */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">How SMRY works</h2>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-[15px] leading-relaxed mb-4">
              SMRY fetches articles from multiple sources simultaneously — direct requests, the Wayback Machine, and reader extraction.
            </p>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              This works for <span className="text-foreground font-medium">soft paywalls</span> (sites that meter free articles or show content to search engines). It does not work for hard paywalls where content requires authentication.
            </p>
          </div>
        </section>

        {/* Paywall Types */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Paywall types</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[15px] font-medium">Soft paywalls</span>
                <span className="text-xs text-muted-foreground">— SMRY works</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The article is in the page, just hidden. Examples: NYT (metered), Medium, most news sites.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-[15px] font-medium">Hard paywalls</span>
                <span className="text-xs text-muted-foreground">— Nobody can bypass</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Content never loads without payment. Examples: Bloomberg, WSJ, The Athletic, Patreon.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            <Link href="/hard-paywalls" className="text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground">
              See full list of hard-paywalled sites
            </Link>
          </p>
        </section>

        {/* Alternatives */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">When SMRY doesn&apos;t work</h2>
          <div className="space-y-3">
            {methods.map((method, i) => (
              <div key={method.name} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[15px] font-medium">{i + 1}. {method.name}</span>
                  {method.tag && (
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                      method.tagColor === "emerald"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {method.tag}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  {method.description}
                </p>
                {method.code && (
                  <div className="rounded bg-muted px-3 py-2 font-mono text-sm mb-2">
                    {method.code}
                  </div>
                )}
                {method.note && (
                  <p className="text-xs text-muted-foreground">
                    {method.note}
                  </p>
                )}
              </div>
            ))}
            <div className="rounded-lg border border-border/50 bg-card/50 p-5 opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[15px] font-medium text-muted-foreground">Google Cache</span>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Discontinued
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Google Cache was discontinued in September 2024. Google now links to the Wayback Machine instead.
              </p>
            </div>
          </div>
        </section>

        {/* What Won't Work */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">What won&apos;t work</h2>
          <div className="rounded-lg border border-border bg-card p-5">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <div>
                  <p className="text-[15px] leading-relaxed">
                    <span className="font-medium">Hard paywalls cannot be bypassed</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Content is never sent without authentication. No tool can get it.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <div>
                  <p className="text-[15px] leading-relaxed">
                    <span className="font-medium">Browser extensions with big claims</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Most work the same way SMRY does. If we can&apos;t get it, they probably can&apos;t either.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <div>
                  <p className="text-[15px] leading-relaxed">
                    <span className="font-medium">Disabling JavaScript</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Used to work, but most sites now use server-side paywalls.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Feedback */}
        <section className="mb-12">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-[15px] font-medium mb-2">Help us improve</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Found a site that should work but doesn&apos;t? Got a truncated article? Have an idea?
            </p>
            <a
              href="https://github.com/mrmps/SMRY/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
            >
              Open an issue on GitHub →
            </a>
          </div>
        </section>

        {/* Honest Truth */}
        <section className="mb-12">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
              The honest truth
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300/80 leading-relaxed">
              No tool can guarantee access to every article. Paywalls exist because journalism costs money. For publications you read regularly, consider subscribing — many offer student discounts or regional pricing.
            </p>
          </div>
        </section>

        <footer className="border-t border-border/50 pt-8">
          <p className="text-sm text-muted-foreground">
            Questions or feedback?{" "}
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
