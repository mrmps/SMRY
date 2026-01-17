// ReactScan must be the top-most import (before React)
import { ReactScan } from "@/components/shared/react-scan";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { GoogleAnalytics } from '@next/third-parties/google'
import { QueryProvider } from "@/components/shared/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { getLocale } from 'next-intl/server';

export const metadata: Metadata = {
  title: "Bypass Paywalls & Read Full Articles Free – No Login | Smry",
  description:
    "Paste any paywalled article link and get the full text plus an AI summary. Free to use, no account, no browser extension. Works on most major news sites.",
  keywords: ["bypass paywall", "paywall remover", "read paywalled articles", "free paywall bypass", "article summarizer", "remove paywall"],
  openGraph: {
    type: "website",
    title: "Bypass Paywalls & Read Full Articles Free | Smry",
    siteName: "smry.ai",
    url: "https://smry.ai",
    description:
      "Paste any paywalled article link and get the full text plus an AI summary. Free to use, no account, no browser extension.",
    images: [
      {
        url: "https://smry.ai/og-image.png",
        width: 1200,
        height: 630,
        alt: "Smry - Free Paywall Bypass Tool & Article Summarizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bypass Paywalls & Read Full Articles Free | Smry",
    description:
      "Paste any paywalled article link and get the full text plus an AI summary. Free, no account, no extension.",
    images: ["https://smry.ai/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <ClerkProvider>
      <html lang={locale} className="bg-background dark:bg-background" suppressHydrationWarning>
        <ReactScan />
        <body
          className={`${GeistSans.className} bg-background text-foreground`}
        >
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
