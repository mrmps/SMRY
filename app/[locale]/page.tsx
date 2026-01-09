import { HomeContent } from "@/components/features/home-content";
import { setRequestLocale } from 'next-intl/server';

// Force static generation for this page
export const dynamic = 'force-static';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}
