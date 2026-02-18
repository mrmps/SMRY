// ReactScan must be the top-most import (before React)
import { ReactScan } from "@/components/shared/react-scan";
import { ReactGrab } from "@/components/shared/react-grab";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Syne, Literata, Atkinson_Hyperlegible, Merriweather } from "next/font/google";
import "./globals.css";
import "streamdown/styles.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

// Literata - Premium reading font designed for long-form content
const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
});

// Atkinson Hyperlegible - Optimized for visual clarity and accessibility
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

// Merriweather - Elegant screen-optimized serif
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-merriweather",
  display: "swap",
});
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { GoogleAnalytics } from '@next/third-parties/google'
import { Databuddy } from "@databuddy/sdk/react"
import { QueryProvider } from "@/components/shared/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { getLocale } from 'next-intl/server';
import { JsonLd, organizationSchema, websiteSchema } from "@/components/seo/json-ld";

// Root metadata - OG images are handled by file-based convention (opengraph-image.tsx)
// in each route segment for proper caching and to avoid robots.txt blocking issues
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
    // Images handled by opengraph-image.tsx files in route segments for proper caching and reliability
  },
  twitter: {
    card: "summary_large_image",
    title: "Read Anything, Summarize Everything | Smry",
    description:
      "AI-powered reader that bypasses paywalls and summarizes any article. News, research papers, paywalled content—we read it all.",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf6f1' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1e21' },
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
          className={`${GeistSans.className} ${GeistSans.variable} ${syne.variable} ${literata.variable} ${atkinson.variable} ${merriweather.variable} bg-background text-foreground`}
        >
          <Databuddy
            clientId="638f8e5f-f436-4d00-a459-66dee9152e3c"
            trackPerformance
            trackWebVitals
            trackErrors
          />
          {/* Structured data for SEO - placed in body for Next.js App Router compatibility */}
          <JsonLd data={organizationSchema} />
          <JsonLd data={websiteSchema} />
          <ReactScan />
          <ReactGrab />
          <ThemeProvider
            attribute="class"
            defaultTheme="carbon"
            themes={["light", "pure-light", "dark", "magic-blue", "classic-dark", "carbon", "black", "winter", "forest", "dawn"]}
            disableTransitionOnChange
          >
            <GoogleAnalytics gaId="G-RFC55FX414" />
            <NuqsAdapter>
              <QueryProvider>
                {children}
                <Toaster position="top-center" />
              </QueryProvider>
            </NuqsAdapter>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
