import { setRequestLocale } from 'next-intl/server';
import { ChangelogContent } from '@/components/pages/changelog-content';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: "Changelog - What's New | SMRY",
  description:
    'Latest updates, features, and improvements to SMRY - the AI article reader and paywall bypass tool.',
  alternates: {
    canonical: 'https://smry.ai/changelog',
  },
  openGraph: {
    title: "What's New at SMRY",
    description:
      'Latest updates and features for the AI article reader and summarizer.',
    url: 'https://smry.ai/changelog',
  },
  twitter: {
    title: "What's New at SMRY",
    description:
      'Latest updates and features for the AI article reader and summarizer.',
  },
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ChangelogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ChangelogContent />;
}
