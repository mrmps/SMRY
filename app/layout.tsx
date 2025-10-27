import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { GoogleAnalytics } from '@next/third-parties/google'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  openGraph: {
    type: "website",
    title: "Smry | AI Summarizer and Free Paywall Remover",
    siteName: "smry.ai",
    url: "https://smry.ai",
    description:
      "Remove paywalls and summarize articles for free, covering NYT, Washington Post & more. Instant access to content without login for faster insights.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#FAFAFA]">
      {/* <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head> */}
      <body
        className={`${GeistSans.className} bg-[#FAFAFA]`}
        // style={{background: "#E5EDF0"}}
        // style={{
        //   background:
        //     "radial-gradient(circle at 18.7% 37.8%, rgb(250, 250, 250) 0%, rgb(225, 234, 238) 90%);",
        // }}
      >
        <GoogleAnalytics gaId="G-RFC55FX414" />
        {children}
      </body>
    </html>
  );
}
