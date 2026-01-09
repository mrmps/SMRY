import { setRequestLocale } from 'next-intl/server';
import { HistoryPageContent } from '@/components/pages/history-content';

// Force static generation - auth is handled client-side
export const dynamic = 'force-static';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HistoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HistoryPageContent />;
}
