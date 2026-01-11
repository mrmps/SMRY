import { setRequestLocale } from 'next-intl/server';
import { ChangelogContent } from '@/components/pages/changelog-content';

export const dynamic = 'force-static';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ChangelogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ChangelogContent />;
}
