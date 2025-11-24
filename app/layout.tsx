import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { GoogleAnalytics } from '@next/third-parties/google'
import { QueryProvider } from "@/components/shared/query-provider";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Smry | AI Summarizer and Free Paywall Remover",
  description:
    "Remove paywalls and summarize articles for free. Instant access to content without login for faster insights.",
  openGraph: {
    type: "website",
    title: "Smry | AI Summarizer and Free Paywall Remover",
    siteName: "smry.ai",
    url: "https://smry.ai",
    description:
      "Remove paywalls and summarize articles for free. Instant access to content without login for faster insights.",
    images: [
      {
        url: "https://smry.ai/og-image.png",
        width: 1200,
        height: 630,
        alt: "Smry - AI Summarizer and Free Paywall Remover",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Smry | AI Summarizer and Free Paywall Remover",
    description:
      "Remove paywalls and summarize articles for free. Instant access to content without login for faster insights.",
    images: ["https://smry.ai/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-background dark:bg-background" suppressHydrationWarning>
      {/* <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head> */}
      <body
        className={`${GeistSans.className} bg-background text-foreground`}
        // style={{background: "#E5EDF0"}}
        // style={{
        //   background:
        //     "radial-gradient(circle at 18.7% 37.8%, rgb(250, 250, 250) 0%, rgb(225, 234, 238) 90%);",
        // }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
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
  );
}
