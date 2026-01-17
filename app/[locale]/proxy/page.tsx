import { setRequestLocale } from 'next-intl/server';
import { ProxyPageContent } from '@/components/pages/proxy-content';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sidebar?: string }>;
};

export default async function ProxyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { sidebar } = await searchParams;
  setRequestLocale(locale);

  // Parse sidebar param on server to prevent layout shift
  const initialSidebarOpen = sidebar === 'true';

  return <ProxyPageContent initialSidebarOpen={initialSidebarOpen} />;
}
