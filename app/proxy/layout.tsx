import type { Metadata } from "next";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "SMRY AI",
  description:
    "Discover SMRY: an AI tool that not only summarizes long texts for quick comprehension but also skillfully navigates through paywalls, offering rapid access to restricted content.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section><Nav />{children}</section>
}
