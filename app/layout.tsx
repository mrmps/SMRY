// ReactScan must be the top-most import (before React)
import { ReactScan } from "@/components/shared/react-scan";
import { ReactGrab } from "@/components/shared/react-grab";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { GoogleAnalytics } from '@next/third-parties/google'
import { QueryProvider } from "@/components/shared/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { getLocale } from 'next-intl/server';

export const metadata: Metadata = {
  title: "Read Anything, Summarize Everything | Smry",
  description:
    "AI-powered reader that bypasses paywalls and summarizes any article. Paste a link, get the full text plus an AI summary. Free, no account needed.",
  keywords: ["bypass paywall", "paywall remover", "read paywalled articles", "free paywall bypass", "article summarizer", "AI reader", "research papers"],
  openGraph: {
    type: "website",
    title: "Read Anything, Summarize Everything | Smry",
    siteName: "smry.ai",
    url: "https://smry.ai",
    description:
      "AI-powered reader that bypasses paywalls and summarizes any article. News, research papers, paywalled content—we read it all.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Read Anything, Summarize Everything | Smry",
    description:
      "AI-powered reader that bypasses paywalls and summarizes any article. News, research papers, paywalled content—we read it all.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  // Clerk appearance configuration to hide duplicate close buttons in checkout/subscription drawers
  // The drawer shows both a "Done" button and a redundant "Close" button - hide the extra one
  const clerkAppearance = {
    elements: {
      drawerClose: { display: "none" },
    },
  };

  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang={locale} className="bg-background dark:bg-background" suppressHydrationWarning>
        <body
          className={`${GeistSans.className} ${syne.variable} bg-background text-foreground`}
        >
          <ReactScan />
          <ReactGrab />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            themes={["light", "pure-light", "dark", "magic-blue", "classic-dark", "system"]}
            disableTransitionOnChange
          >
            <GoogleAnalytics gaId="G-RFC55FX414" />
            <NuqsAdapter>
              <QueryProvider>
                {children}
              </QueryProvider>
            </NuqsAdapter>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
