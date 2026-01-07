import { Link } from "@/i18n/navigation";
import { ArrowLeft, Lock, Unlock, AlertTriangle, Users, FileText, Share2 } from "lucide-react";
import { getSitesGroupedByCategory, CATEGORY_INFO, type PaywallCategory } from "@/lib/hard-paywalls";

export const metadata = {
  title: "Hard Paywalls vs Soft Paywalls | SMRY",
  description: "Learn the difference between hard and soft paywalls, and why some sites cannot be accessed through SMRY.",
};

const CATEGORY_ICONS: Record<PaywallCategory, React.ReactNode> = {
  news: <Lock className="w-4 h-4" />,
  creator: <Users className="w-4 h-4" />,
  social: <Share2 className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  other: <Lock className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<PaywallCategory, string> = {
  news: "bg-red-900/30 text-red-400",
  creator: "bg-teal-900/30 text-teal-400",
  social: "bg-blue-900/30 text-blue-400",
  document: "bg-amber-900/30 text-amber-400",
  other: "bg-zinc-800 text-zinc-400",
};

function BlockedSitesSection() {
  const groupedSites = getSitesGroupedByCategory();
  const categoryOrder: PaywallCategory[] = ["creator", "social", "document", "news", "other"];

  return (
    <section className="mb-12">
      <h2 className="text-xl font-semibold mb-4">Sites That Cannot Be Accessed</h2>
      <p className="text-zinc-400 mb-6">
        The following sites cannot be accessed through SMRY for various reasons.
        Understanding why helps set the right expectations.
      </p>

      <div className="space-y-6">
        {categoryOrder.map((category) => {
          const sites = groupedSites[category];
          if (sites.length === 0) return null;

          const info = CATEGORY_INFO[category];

          return (
            <div key={category} className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                <div className={`p-1.5 rounded ${CATEGORY_COLORS[category]}`}>
                  {CATEGORY_ICONS[category]}
                </div>
                <div>
                  <h3 className="font-medium text-zinc-200">{info.title}</h3>
                  <p className="text-xs text-zinc-500">{info.description}</p>
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {sites.map((site) => (
                    <span
                      key={site.hostname}
                      className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400"
                    >
                      {site.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function HardPaywallsPage() {
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
          Understanding Paywalls
        </h1>
        <p className="text-zinc-400 text-lg mb-12">
          Why some articles can be accessed through SMRY and others cannot.
        </p>

        {/* Soft Paywalls Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-900/30">
              <Unlock className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold">Soft Paywalls</h2>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <p className="text-zinc-300 mb-4">
              Soft paywalls are designed to limit access while still allowing some free views.
              These sites typically use one of these methods:
            </p>
            <ul className="space-y-3 text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Metered paywalls:</strong> Allow a certain number of free articles per month before blocking access.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Registration walls:</strong> Require a free account to read articles.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Cookie-based limits:</strong> Track reading history in your browser to enforce limits.</span>
              </li>
            </ul>
            <p className="text-zinc-300 mt-4">
              SMRY can often access content behind soft paywalls because the full article
              is loaded in the page source or available through web archives.
            </p>
          </div>
        </section>

        {/* Hard Paywalls Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-900/30">
              <Lock className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold">Hard Paywalls</h2>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <p className="text-zinc-300 mb-4">
              Hard paywalls are strict barriers that require payment before any content is delivered.
              These sites:
            </p>
            <ul className="space-y-3 text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Never expose full content:</strong> The article text is only sent to paying subscribers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Server-side enforcement:</strong> Access control happens on their servers, not in your browser.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span><strong className="text-zinc-300">Block all extraction methods:</strong> Web archives, readers, and APIs cannot access the content.</span>
              </li>
            </ul>
            <p className="text-zinc-300 mt-4">
              <strong>SMRY cannot bypass hard paywalls.</strong> There is no technical workaround
              because the content simply is not available without authentication.
            </p>
          </div>
        </section>

        {/* Why We Don't Claim to Bypass Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-900/30">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold">Our Approach</h2>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <p className="text-zinc-300 mb-4">
              SMRY is designed to help you read articles more easily, not to circumvent
              legitimate access controls. We:
            </p>
            <ul className="space-y-3 text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span>Use publicly available web archives and reader modes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span>Respect robots.txt and site access policies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span>Clearly tell you when a site cannot be accessed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span>Encourage subscribing to publications you read regularly</span>
              </li>
            </ul>
            <p className="text-zinc-300 mt-4">
              Quality journalism costs money to produce. If you find value in a publication,
              consider supporting them with a subscription.
            </p>
          </div>
        </section>

        {/* Blocked Sites List - Grouped by Category */}
        <BlockedSitesSection />

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
              <h3 className="font-medium text-zinc-200 mb-2">
                Why does SMRY work for some articles but not others on the same site?
              </h3>
              <p className="text-zinc-400">
                Many publications use a hybrid approach where some content is free and some is
                premium. SMRY can only access the free content. Additionally, web archives may
                have captured some articles before they were paywalled.
              </p>
            </div>

            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
              <h3 className="font-medium text-zinc-200 mb-2">
                Will a site ever be removed from the hard paywall list?
              </h3>
              <p className="text-zinc-400">
                Yes, if a publication changes their paywall policy. We regularly review our
                analytics to update this list. If you notice a site is working that was
                previously blocked, let us know.
              </p>
            </div>

            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
              <h3 className="font-medium text-zinc-200 mb-2">
                Can I request support for a specific site?
              </h3>
              <p className="text-zinc-400">
                We cannot add support for hard-paywalled sites as there is no technical
                way to access their content. For soft-paywalled sites that are not working,
                you can report issues through our feedback form.
              </p>
            </div>
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
