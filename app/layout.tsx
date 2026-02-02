// ReactScan must be the top-most import (before React)
import { ReactScan } from "@/components/shared/react-scan";
import { ReactGrab } from "@/components/shared/react-grab";
import type { Metadata, Viewport } from "next";
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
import { JsonLd, organizationSchema, websiteSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  metadataBase: new URL("https://smry.ai"),
  title: "Read Anything, Summarize Everything | Smry",
  description:
    "AI-powered reader that bypasses paywalls and summarizes any article. Paste a link, get the full text plus an AI summary. Free, no account needed.",
  keywords: ["bypass paywall", "paywall remover", "read paywalled articles", "free paywall bypass", "article summarizer", "AI reader", "research papers"],
  // Note: alternates (canonical + hreflang) are set per-page in each page.tsx
  // to ensure correct locale-specific URLs. Do NOT add global alternates here.
  openGraph: {
    type: "website",
    title: "Read Anything, Summarize Everything | Smry",
    siteName: "smry.ai",
    url: "https://smry.ai",
    description:
      "AI-powered reader that bypasses paywalls and summarizes any article. News, research papers, paywalled content—we read it all.",
    images: [
      {
        url: "https://smry.ai/opengraph-image",
        width: 1200,
        height: 630,
        alt: "smry - Read Anything, Summarize Everything",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Read Anything, Summarize Everything | Smry",
    description:
      "AI-powered reader that bypasses paywalls and summarizes any article. News, research papers, paywalled content—we read it all.",
    images: ["https://smry.ai/opengraph-image"],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
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
          {/* Structured data for SEO - placed in body for Next.js App Router compatibility */}
          <JsonLd data={organizationSchema} />
          <JsonLd data={websiteSchema} />
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
