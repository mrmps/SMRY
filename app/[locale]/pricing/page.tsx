import { setRequestLocale } from 'next-intl/server';
import { PricingContent } from '@/components/pages/pricing-content';

// Force static generation - auth is handled client-side by PricingContent
export const dynamic = 'force-static';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PricingContent />;
}
