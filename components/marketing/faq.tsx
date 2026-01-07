"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslations } from "next-intl";

export function FAQ() {
  const t = useTranslations("faq");

  const faqData = [
    { question: t("q1"), answer: t("a1") },
    { question: t("q2"), answer: t("a2") },
    { question: t("q3"), answer: t("a3") },
    {
      question: t("q4"),
      answer: (
        <>
          {t("a4")}{" "}
          <a
            href="https://github.com/mrmps/SMRY"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
          >
            https://github.com/mrmps/SMRY
          </a>
          .
        </>
      ),
    },
    { question: t("q5"), answer: t("a5") },
    { question: t("q6"), answer: t("a6") },
    { question: t("q7"), answer: t("a7") },
    {
      question: t("q8"),
      answer: (
        <>
          {t("a8")}
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              {t("a8Option1", {
                code: "http://smry.ai/",
                example: "http://smry.ai/https://www.wsj.com/..."
              }).split("{code}").map((part, i) =>
                i === 0 ? part : (
                  <span key={i}>
                    <code className="rounded bg-yellow-100 px-1 py-0.5 font-mono text-xs text-neutral-800 dark:bg-yellow-900 dark:text-neutral-200">
                      http://smry.ai/
                    </code>
                    {part}
                  </span>
                )
              )}
            </li>
            <li>{t("a8Option2")}</li>
            <li>{t("a8Option3")}</li>
          </ol>
        </>
      ),
    },
    { question: t("q9"), answer: t("a9") },
  ];

  return (
    <div className="mx-auto mt-12 w-full max-w-3xl">
      <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
        {t("title")}
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {faqData.map((item, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left font-medium text-foreground">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-12 space-y-2 text-center">
        <p className="text-muted-foreground">
          {t("feedbackPrompt")}{" "}
          <a
            href="https://smryai.userjot.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
          >
            {t("shareThoughts")}
          </a>
        </p>
        <p className="text-sm text-muted-foreground">
          {t("sponsorships")}{" "}
          <a
            href="mailto:contact@smry.ai"
            className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
          >
            contact@smry.ai
          </a>
        </p>
      </div>
    </div>
  );
}

