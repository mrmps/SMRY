import { setRequestLocale } from 'next-intl/server';
import { HistoryPageContent } from '@/components/pages/history-content';
import type { Metadata } from 'next';

// Force static generation - auth is handled client-side
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Reading History | SMRY',
  description:
    'View your reading history and previously summarized articles on SMRY.',
  alternates: {
    canonical: 'https://smry.ai/history',
  },
  robots: {
    index: false,
    follow: true,
  },
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HistoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HistoryPageContent />;
}
