import { Link } from "@/i18n/navigation";
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, AlertTriangle, HelpCircle, Archive, Globe, Shield, MessageSquare } from "lucide-react";
import { setRequestLocale } from 'next-intl/server';

// Force static generation for this page
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to SMRY
        </Link>

        {/* Header */}
        <h1 className="text-3xl font-bold mb-4">
          Paywall Bypass Guide
        </h1>
        <p className="text-zinc-400 text-lg mb-12">
          An honest guide to what works, what doesn&apos;t, and what to try when you can&apos;t access an article.
        </p>

        {/* What SMRY Does Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-900/30">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold">What SMRY Does</h2>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <p className="text-zinc-300 mb-4">
              SMRY tries to fetch article content from multiple sources simultaneously:
            </p>
            <ul className="space-y-3 text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Direct fetch</strong> — We request the page like a search engine would</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Wayback Machine</strong> — We check if archive.org has a copy</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Reader extraction</strong> — We parse the page to extract just the article text</span>
              </li>
            </ul>
            <p className="text-zinc-300 mt-4">
              This works well for <strong>soft paywalls</strong> — sites that meter your free articles
              or show content to search engines. It does <em>not</em> work for hard paywalls where
              the content is never publicly accessible.
            </p>
          </div>
        </section>

        {/* Hard vs Soft Paywalls - Brief */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-900/30">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold">Hard vs. Soft Paywalls</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <h3 className="font-medium text-zinc-200">Soft Paywalls</h3>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                The article is in the page, just hidden. SMRY can usually get these.
              </p>
              <p className="text-xs text-zinc-500">
                Examples: NYT (metered), Medium, many news sites
              </p>
            </div>

            <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-red-400" />
                <h3 className="font-medium text-zinc-200">Hard Paywalls</h3>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                The article never loads without payment. Nobody can bypass these.
              </p>
              <p className="text-xs text-zinc-500">
                Examples: Bloomberg, WSJ, The Athletic, Patreon
              </p>
            </div>
          </div>

          <p className="text-sm text-zinc-500 mt-4">
            <Link href="/hard-paywalls" className="text-emerald-400 hover:underline">
              See our full list of hard-paywalled sites →
            </Link>
          </p>
        </section>

        {/* When SMRY Doesn't Work Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <HelpCircle className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold">When SMRY Doesn&apos;t Work</h2>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mb-4">
            <p className="text-zinc-300 mb-4">
              If SMRY couldn&apos;t get your article, here are alternatives to try — in order of what&apos;s most likely to work:
            </p>
          </div>

          {/* Alternative 1: archive.is */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-emerald-900/50 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Archive className="w-5 h-5 text-emerald-400" />
              <h3 className="font-medium text-zinc-200">1. Try archive.is</h3>
              <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full">Best option</span>
            </div>
            <p className="text-zinc-400 mb-4">
              Archive.is (also archive.today, archive.ph) is often the most effective alternative.
              Unlike SMRY, it doesn&apos;t respect robots.txt, so it can archive content that we can&apos;t access.
            </p>
            <div className="bg-zinc-800 rounded p-3 font-mono text-sm text-zinc-300 mb-3">
              https://archive.is/newest/<span className="text-emerald-400">[your-url]</span>
            </div>
            <p className="text-xs text-zinc-500">
              If no archive exists, you can request one — but it may take a few minutes.
            </p>
          </div>

          {/* Alternative 2: Wayback Machine */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-blue-400" />
              <h3 className="font-medium text-zinc-200">2. Try Wayback Machine directly</h3>
            </div>
            <p className="text-zinc-400 mb-4">
              We check the Wayback Machine, but sometimes browsing it directly works when our automated fetch doesn&apos;t.
              Look for older snapshots — they may have been captured before the paywall was added.
            </p>
            <div className="bg-zinc-800 rounded p-3 font-mono text-sm text-zinc-300 mb-3">
              https://web.archive.org/web/*/<span className="text-blue-400">[your-url]</span>
            </div>
            <p className="text-xs text-zinc-500">
              Check the calendar for different dates. Older archives may have the full content.
            </p>
          </div>

          {/* Alternative 3: Incognito Mode */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-purple-400" />
              <h3 className="font-medium text-zinc-200">3. Try incognito mode</h3>
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">Metered paywalls only</span>
            </div>
            <p className="text-zinc-400 mb-4">
              Some sites track how many free articles you&apos;ve read using cookies. Opening the link
              in an incognito/private window resets this counter.
            </p>
            <p className="text-zinc-400">
              <strong className="text-zinc-300">This only works for metered paywalls</strong> — sites that give you
              X free articles per month. It won&apos;t help with hard paywalls or registration walls.
            </p>
          </div>

          {/* Google Cache - RIP */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800/50 opacity-75">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-zinc-500" />
              <h3 className="font-medium text-zinc-400">Google Cache</h3>
              <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">Discontinued</span>
            </div>
            <p className="text-zinc-500">
              Google Cache was discontinued in September 2024. The &quot;cache:&quot; search operator
              no longer works. Google now links to the Wayback Machine instead.
            </p>
          </div>
        </section>

        {/* What Won't Work Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-900/30">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold">What Won&apos;t Work</h2>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <p className="text-zinc-300 mb-4">
              Be skeptical of tools or methods claiming to bypass all paywalls. Here&apos;s the reality:
            </p>
            <ul className="space-y-3 text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Hard paywalls cannot be bypassed</strong> — the content is never sent to your browser without authentication. No tool can get content that doesn&apos;t exist publicly.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Browser extensions with big claims</strong> — most work the same way SMRY does. If we can&apos;t get it, they probably can&apos;t either.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Disabling JavaScript</strong> — used to work for some sites, but most have moved to server-side paywalls.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Feedback Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-teal-900/30">
              <MessageSquare className="w-5 h-5 text-teal-400" />
            </div>
            <h2 className="text-xl font-semibold">Help Us Improve</h2>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 rounded-lg p-6 border border-teal-900/30">
            <p className="text-zinc-300 mb-4">
              We&apos;re a small team trying to make reading easier. If you have feedback — whether SMRY
              worked great, failed unexpectedly, or you have ideas for improvement — we genuinely want to hear it.
            </p>
            <ul className="space-y-2 text-zinc-400 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-1">•</span>
                <span>Found a site that should work but doesn&apos;t? Let us know.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-1">•</span>
                <span>Got a truncated article when you expected full content? Tell us.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-1">•</span>
                <span>Have an idea for a feature? We&apos;re listening.</span>
              </li>
            </ul>
            <a
              href="https://github.com/anthropics/smry/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors"
            >
              Open an issue on GitHub
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </section>

        {/* The Honest Truth Section */}
        <section className="mb-12">
          <div className="bg-zinc-900/50 rounded-lg p-6 border border-zinc-800">
            <h3 className="font-medium text-zinc-200 mb-3">The honest truth</h3>
            <p className="text-zinc-400">
              No tool — including SMRY — can guarantee access to every article. Paywalls exist because
              journalism costs money to produce. We help you read content that&apos;s technically accessible
              but inconvenient to reach. For publications you read regularly, consider subscribing.
              Many offer student discounts or regional pricing.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-zinc-800 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SMRY
          </Link>
        </div>
      </div>
    </div>
  );
}
