import type { Metadata } from "next";
import { ChatPageContent } from "@/components/features/chat-page-content";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "Chat - Smry",
  description: "Chat with AI about anything. Your conversations are stored locally.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ChatPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ChatPageContent />;
}
