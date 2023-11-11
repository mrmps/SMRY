import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SMRY AI",
  description: "Discover SMRY: an AI tool that not only summarizes long texts for quick comprehension but also skillfully navigates through paywalls, offering rapid access to restricted content.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        {" "}
        <Analytics />
        {children}
      </body>
    </html>
  );
}
