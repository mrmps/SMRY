"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

export function FAQ() {
  const t = useTranslations("faq");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
            className="text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors"
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
                    <code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-xs">
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
    <div className="mx-auto w-full max-w-xl">
      <h2 className="mb-6 text-center text-lg sm:text-xl font-semibold tracking-tight text-foreground">
        {t("title")}
      </h2>
      <div className="space-y-1.5">
        {faqData.map((item, index) => (
          <div
            key={index}
            className="rounded-xl bg-black/[0.025] dark:bg-white/[0.025] overflow-hidden"
          >
            <button
              id={`faq-question-${index}`}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenIndex(openIndex === index ? null : index);
                }
              }}
              className="w-full flex items-center justify-between py-3 px-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
              aria-expanded={openIndex === index}
              aria-controls={`faq-answer-${index}`}
            >
              <span className="text-[14px] font-medium text-foreground pr-4">{item.question}</span>
              <ChevronDown
                aria-hidden="true"
                className={`size-4 shrink-0 text-muted-foreground/40 transition-transform duration-200 motion-reduce:transition-none ${
                  openIndex === index ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              id={`faq-answer-${index}`}
              className={`overflow-hidden transition-all duration-200 motion-reduce:transition-none ${
                openIndex === index ? "max-h-[500px]" : "max-h-0"
              }`}
              role="region"
              aria-labelledby={`faq-question-${index}`}
            >
              <div className="px-4 pb-3 text-[14px] leading-relaxed text-muted-foreground">
                {item.answer}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("feedbackPrompt")}{" "}
        <a
          href="https://smryai.userjot.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors"
        >
          {t("shareThoughts")}
        </a>
      </p>
    </div>
  );
}
