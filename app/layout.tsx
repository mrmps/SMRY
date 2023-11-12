import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SMRY AI",
  description:
    "Discover SMRY: an AI tool that not only summarizes long articles for quick comprehension but also skillfully navigates through paywalls, offering rapid access to restricted content.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={GeistSans.className}
        // style={{background: "#E5EDF0"}}
        // style={{
        //   background:
        //     "radial-gradient(circle at 18.7% 37.8%, rgb(250, 250, 250) 0%, rgb(225, 234, 238) 90%);",
        // }}
      >
        <Analytics />
        {children}
      </body>
    </html>
  );
}
