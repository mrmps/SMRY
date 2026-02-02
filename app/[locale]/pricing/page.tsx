import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PricingContent } from '@/components/pages/pricing-content';
import { generateAlternates } from '@/lib/seo/alternates';

// Force static generation - auth is handled client-side by PricingContent
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Pricing - Free & Pro Plans | SMRY',
  description:
    'Get unlimited article summaries and paywall bypass with SMRY Pro. Start free, upgrade when you need more.',
  alternates: generateAlternates('/pricing'),
  openGraph: {
    title: 'SMRY Pricing - Free & Pro Plans',
    description:
      'Unlimited AI summaries and paywall bypass. Free tier available.',
    url: 'https://smry.ai/pricing',
  },
  twitter: {
    title: 'SMRY Pricing - Free & Pro Plans',
    description:
      'Unlimited AI summaries and paywall bypass. Free tier available.',
  },
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PricingContent />;
}
