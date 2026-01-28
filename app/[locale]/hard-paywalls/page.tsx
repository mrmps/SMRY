import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { getSitesGroupedByCategory, CATEGORY_INFO, type PaywallCategory } from "@/lib/hard-paywalls";
import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { JsonLd, faqSchema } from "@/components/seo/json-ld";

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: "Understanding Paywalls | SMRY",
  description:
    "Learn the difference between hard and soft paywalls, and why some sites cannot be accessed through SMRY.",
  alternates: {
    canonical: 'https://smry.ai/hard-paywalls',
  },
  openGraph: {
    title: 'Understanding Paywalls | SMRY',
    description:
      'Learn the difference between hard and soft paywalls, and why some sites cannot be accessed through SMRY.',
    url: 'https://smry.ai/hard-paywalls',
  },
  twitter: {
    title: 'Understanding Paywalls | SMRY',
    description:
      'Learn the difference between hard and soft paywalls, and why some sites cannot be accessed through SMRY.',
  },
};

const faqs = [
  {
    question: 'Why does SMRY work for some articles but not others on the same site?',
    answer:
      'Many publications use hybrid models where some content is free and some is premium. Web archives may also have captured articles before they were paywalled.',
  },
  {
    question: 'Can I request support for a blocked site?',
    answer:
      "We cannot add support for hard-paywalled sites — there's no technical way to access content that requires authentication. For soft-paywalled sites that aren't working, email us at support@smry.ai.",
  },
];

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HardPaywallsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const groupedSites = getSitesGroupedByCategory();
  const categoryOrder: PaywallCategory[] = ["news", "creator", "social", "document"];

  return (
    <>
      <JsonLd data={faqSchema(faqs)} />
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
          <h1 className="text-2xl font-semibold tracking-tight">Understanding Paywalls</h1>
          <p className="mt-2 text-muted-foreground">
            Why some articles can be accessed through SMRY and others cannot.
          </p>
        </header>

        <article className="space-y-16">
          {/* Soft paywalls */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
              Soft paywalls
            </h2>
            <div className="flex gap-4">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              <div className="space-y-4 text-[15px] leading-relaxed">
                <p>
                  Soft paywalls limit access while still allowing some free views. The article
                  content is loaded in the page, just hidden behind a modal or CSS overlay.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Metered paywalls</strong> give you a certain number
                  of free articles per month. <strong className="text-foreground">Registration walls</strong> require
                  a free account. <strong className="text-foreground">Cookie-based limits</strong> track your
                  reading history in the browser.
                </p>
                <p className="text-muted-foreground">
                  SMRY can often access this content because the full article is in the page
                  source or available through web archives.
                </p>
              </div>
            </div>
          </section>

          {/* Hard paywalls */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
              Hard paywalls
            </h2>
            <div className="flex gap-4">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
              <div className="space-y-4 text-[15px] leading-relaxed">
                <p>
                  Hard paywalls require payment before any content is delivered. The article
                  text is only sent to authenticated subscribers — it never exists publicly.
                </p>
                <p className="text-muted-foreground">
                  Access control happens on the server, not in your browser. Web archives,
                  reader modes, and extraction tools cannot access content that was never sent.
                </p>
                <p>
                  <strong>SMRY cannot bypass hard paywalls.</strong> There is no technical
                  workaround because the content simply does not exist without authentication.
                </p>
              </div>
            </div>
          </section>

          {/* Known sites */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
              Known restricted sites
            </h2>
            <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
              These sites have access restrictions that prevent content extraction.
              This list is based on our analytics data and is not exhaustive.
            </p>

            <div className="space-y-8">
              {categoryOrder.map((category) => {
                const sites = groupedSites[category];
                if (sites.length === 0) return null;
                const info = CATEGORY_INFO[category];

                return (
                  <div key={category}>
                    <p className="text-sm font-medium mb-2">{info.title}</p>
                    <p className="text-xs text-muted-foreground mb-3">{info.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sites.map((site) => (
                        <span
                          key={site.hostname}
                          className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground"
                        >
                          {site.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* FAQ */}
          <section className="border-t border-border pt-12">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
              Questions
            </h2>
            <div className="space-y-8 text-[15px] leading-relaxed">
              <div>
                <p className="font-medium mb-2">
                  Why does SMRY work for some articles but not others on the same site?
                </p>
                <p className="text-muted-foreground">
                  Many publications use hybrid models where some content is free and some is
                  premium. Web archives may also have captured articles before they were paywalled.
                </p>
              </div>
              <div>
                <p className="font-medium mb-2">
                  Can I request support for a blocked site?
                </p>
                <p className="text-muted-foreground">
                  We cannot add support for hard-paywalled sites — there&apos;s no technical way
                  to access content that requires authentication. For soft-paywalled sites that
                  aren&apos;t working, email us at{" "}
                  <a
                    href="mailto:support@smry.ai"
                    className="text-foreground underline underline-offset-4"
                  >
                    support@smry.ai
                  </a>.
                </p>
              </div>
            </div>
          </section>

          {/* Ethics note */}
          <section className="border-t border-border pt-12">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Quality journalism costs money to produce. SMRY helps you read content that&apos;s
              technically accessible but inconvenient to reach. For publications you value,
              consider supporting them with a subscription.
            </p>
          </section>
        </article>

        <footer className="mt-16 pt-8 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            <Link
              href="/guide"
              className="text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
            >
              ← Back to guide
            </Link>
          </p>
        </footer>
      </div>
    </main>
    </>
  );
}
