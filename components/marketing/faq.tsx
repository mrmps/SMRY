"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";

const faqData = [
  {
    question: "How does paywall bypass work?",
    answer: (
      <>
        There are two types of paywalls: hard paywalls and soft paywalls. Hard paywalls don&apos;t expose content to the client until you subscribe, so they can&apos;t be bypassed with traditional methods. Most sites use soft paywalls, where content is accessible but blocked by popups or only exposed to certain user agents like Googlebot. SMRY tries multiple methods: fetching from Wayback Machine archives, Google Cache, direct access with Googlebot user agent emulation, and other content sources. We display whichever source responds first, maximizing your chances of accessing content behind paywalls.
      </>
    ),
  },
  {
    question: "How do I know if content can be bypassed?",
    answer: (
      <>
        If a site needs to show content to search engines for SEO, it likely uses a soft paywall that can be bypassed. If some content is visible but part is obstructed, it&apos;s often a soft paywall. If no content is visible at all, it&apos;s likely a hard paywall. Hard paywalls are common for subscription services like Patreon, OnlyFans, or download-only content. If SMRY or other bypass tools don&apos;t work, that&apos;s a strong sign it&apos;s a hard paywall.
      </>
    ),
  },
  {
    question: "What sources does SMRY use?",
    answer: (
      <>
        SMRY tries multiple sources in parallel: Wayback Machine (archive.org) archives, Google Cache, direct fetches with Googlebot user agent emulation, and other content sources. We also show you which source successfully provided the content, so you can try different options if one fails.
      </>
    ),
  },
  {
    question: "Is SMRY open source?",
    answer: (
      <>
        Yes! SMRY is completely open source. You can view the code, contribute, or run your own instance at{" "}
        <Link
          href="https://github.com/mrmps/SMRY"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 hover:underline"
        >
          https://github.com/mrmps/SMRY
        </Link>
        .
      </>
    ),
  },
  {
    question: "How fast are summaries generated?",
    answer:
      "Summaries are generated in seconds using AI. We cache summaries to provide instant results for articles that have been summarized before.",
  },
  {
    question: "What languages are supported for summaries?",
    answer:
      "Summaries are available in 8 languages: English, Spanish, French, German, Italian, Portuguese, Russian, and Chinese. Select your preferred language when generating a summary.",
  },
  {
    question: "Is there a limit to how many summaries I can generate?",
    answer:
      "Yes, to ensure fair usage, there are rate limits: 20 summaries per day and 6 summaries per minute per IP address.",
  },
  {
    question: "How do I use SMRY?",
    answer:
      "You can use SMRY in three ways: 1) Paste a URL directly on our homepage, 2) Prepend &apos;https://smry.ai/&apos; to any article URL, or 3) Use our bookmarklet by dragging it to your bookmarks bar and clicking it on any page.",
  },
  {
    question: "Does this work with all websites?",
    answer:
      "SMRY works with most websites that use soft paywalls. Hard paywalls (like Patreon, OnlyFans, or sites that require login to download files) cannot be bypassed. We use multiple content sources in parallel to maximize success rates across different types of paywalls.",
  },
];

export function FAQ() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-12">
      <h2 className="text-2xl font-semibold text-center text-neutral-800 mb-8">
        Frequently Asked Questions
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {faqData.map((item, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left text-neutral-800 font-medium">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-neutral-600">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-12 text-center space-y-2">
        <p className="text-neutral-600">
          Have feedback or questions?{" "}
          <Link
            href="https://smryai.userjot.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline font-medium"
          >
            Share your thoughts
          </Link>
        </p>
        <p className="text-neutral-600 text-sm">
          For sponsorships and inquiries:{" "}
          <a
            href="mailto:contact@smry.ai"
            className="text-purple-600 hover:underline font-medium"
          >
            contact@smry.ai
          </a>
        </p>
      </div>
    </div>
  );
}

