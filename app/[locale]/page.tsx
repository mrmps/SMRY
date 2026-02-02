import type { Metadata } from 'next';
import { HomeContent } from "@/components/features/home-content";
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { generateAlternates } from '@/lib/seo/alternates';

// Force static generation for this page
export const dynamic = 'force-static';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'Bypass Paywalls & Read Full Articles Free - No Login | Smry',
  description: 'Paste any paywalled article link and get the full text plus an AI summary. Free to use, no account, no browser extension. Works on most major news sites.',
  alternates: generateAlternates('/'),
  openGraph: {
    title: 'Bypass Paywalls & Read Full Articles Free | Smry',
    description: 'Paste any paywalled article link and get the full text plus an AI summary. Free to use, no account required.',
    url: 'https://smry.ai',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bypass Paywalls & Read Full Articles Free | Smry',
    description: 'Paste any paywalled article link and get the full text plus an AI summary. Free to use, no account required.',
  },
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}
