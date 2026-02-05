import type { Metadata } from "next";
import { ChatPageContent } from "@/components/features/chat-page-content";
import { setRequestLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Chat - Smry",
  description: "Chat with AI about anything. Your conversations are stored locally.",
};

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ChatThreadPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <ChatPageContent threadId={id} />;
}
