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

export default async function GuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background text-foreground">
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

      <div className="mx-auto max-w-2xl px-4 py-16">
        <header className="mb-16">
          <h1 className="text-2xl font-semibold tracking-tight">Paywall Bypass Guide</h1>
          <p className="mt-2 text-muted-foreground">
            An honest guide to what works and what doesn&apos;t.
          </p>
        </header>

        <article className="space-y-16">
          {/* How it works */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
              How SMRY works
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed">
              <p>
                SMRY fetches articles from multiple sources simultaneously — direct requests,
                the Wayback Machine, and reader extraction. This works for{" "}
                <strong>soft paywalls</strong>, where the content exists in the page but is hidden
                behind a meter or cookie-based limit.
              </p>
              <p className="text-muted-foreground">
                It does not work for hard paywalls, where content requires authentication
                and is never publicly accessible.
              </p>
            </div>
          </section>

          {/* Paywall types */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
              Paywall types
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <div>
                  <p className="font-medium mb-1">Soft paywalls</p>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">
                    The article is in the page, just hidden. SMRY can usually get these.
                    Examples: New York Times, Washington Post, The Atlantic.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                <div>
                  <p className="font-medium mb-1">Hard paywalls</p>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">
                    Content never loads without payment — nobody can bypass these.
                    Examples: Bloomberg, WSJ, The Athletic, Patreon, Substack (paid posts).
                  </p>
                  <p className="text-sm mt-2">
                    <Link
                      href="/hard-paywalls"
                      className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                    >
                      Learn more about paywall types →
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Alternatives */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
              When SMRY doesn&apos;t work
            </h2>
            <div className="space-y-8">
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-medium">archive.is</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Most effective</span>
                </div>
                <p className="text-[15px] text-muted-foreground leading-relaxed mb-3">
                  Unlike SMRY, archive.is doesn&apos;t respect robots.txt — it can often archive
                  content we can&apos;t access. Paste your URL after the prefix:
                </p>
                <code className="block text-sm bg-muted px-3 py-2 rounded">
                  https://archive.is/newest/[url]
                </code>
              </div>

              <div>
                <p className="font-medium mb-2">Wayback Machine</p>
                <p className="text-[15px] text-muted-foreground leading-relaxed mb-3">
                  Browse archive.org directly. Older snapshots may have captured the article
                  before the paywall was added.
                </p>
                <code className="block text-sm bg-muted px-3 py-2 rounded">
                  https://web.archive.org/web/*/[url]
                </code>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-medium">Incognito mode</span>
                  <span className="text-xs text-muted-foreground">Metered paywalls only</span>
                </div>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Some sites track free articles via cookies. A private window resets the counter.
                  This only works for metered paywalls that give you X free articles per month.
                </p>
              </div>
            </div>
          </section>

          {/* What won't work */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
              What won&apos;t work
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed">
              <p>
                <strong>Hard paywalls cannot be bypassed.</strong> The content is never sent
                without authentication — no tool can access data that doesn&apos;t exist publicly.
              </p>
              <p className="text-muted-foreground">
                Browser extensions with bold claims typically work the same way SMRY does.
                If we can&apos;t get it, they probably can&apos;t either. Disabling JavaScript
                used to work for some sites, but most have moved to server-side enforcement.
              </p>
            </div>
          </section>

          {/* Honest truth */}
          <section className="border-t border-border pt-12">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              No tool can guarantee access to every article. Paywalls exist because journalism
              costs money. For publications you read regularly, consider subscribing — many offer
              student discounts or regional pricing.
            </p>
          </section>
        </article>

        <footer className="mt-16 pt-8 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Questions?{" "}
            <a
              href="mailto:support@smry.ai"
              className="text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
            >
              support@smry.ai
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
