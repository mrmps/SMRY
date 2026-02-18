import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SettingsContent } from '@/components/pages/settings-content';
import { generateAlternates } from '@/lib/seo/alternates';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'Settings | SMRY',
  description: 'Customize your reading experience with appearance, typography, and language settings.',
  alternates: generateAlternates('/settings'),
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SettingsContent />;
}
