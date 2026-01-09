import { setRequestLocale } from 'next-intl/server';
import { ProxyPageContent } from '@/components/pages/proxy-content';

// Force static generation - URL parsing happens client-side
export const dynamic = 'force-static';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProxyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ProxyPageContent />;
}
