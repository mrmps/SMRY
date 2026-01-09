import { setRequestLocale } from 'next-intl/server';
import { ProxyPageContent } from '@/components/pages/proxy-content';

// Dynamic rendering - page depends on URL query parameters
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProxyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ProxyPageContent />;
}
