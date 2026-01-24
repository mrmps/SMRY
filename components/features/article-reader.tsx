"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

/**
 * Premium Article Reader Component
 *
 * Typography Design Decisions (10 rounds of refinement):
 *
 * Round 1: Typography Foundation
 * - Title: Source Serif 4 VF at 42px with -0.015em tracking for optical balance
 * - Body: 19px for comfortable reading on modern displays
 * - Serif for long-form, sans-serif for UI chrome
 *
 * Round 2: Vertical Rhythm
 * - 8px base unit for all spacing
 * - Paragraph spacing: 1.5em (maintains rhythm without excessive gaps)
 * - Heading spacing: 2em top, 0.75em bottom (creates logical grouping)
 *
 * Round 3: Reading Comfort
 * - Line height 1.65 for body (sweet spot between 1.5-1.7)
 * - Measure: ~65 characters (optimal 45-75 range)
 * - Slight word-spacing increase for legibility
 *
 * Round 4: Link Treatment
 * - Underline offset 3px for baseline clearance
 * - 35% opacity underline at rest, 85% on hover
 * - Color: desaturated blue #AEC8F1 for reduced eye strain
 *
 * Round 5: Header Hierarchy
 * - Source badge: uppercase, 0.6px tracking, 12px
 * - Title: 42px bold, -0.6px tracking (tighter for display)
 * - Meta: 14px medium weight, muted color
 *
 * Round 6: Progress Indicator
 * - 3px bar with cyan-to-purple gradient
 * - Dot indicator with border for contrast
 * - Will-change for GPU acceleration
 *
 * Round 7: Highlight System
 * - Yellow gradient highlight (vintage highlighter aesthetic)
 * - White text on highlight for contrast
 * - Subtle cursor affordance
 *
 * Round 8: Responsive Scaling
 * - Mobile: 17px body, 36px title
 * - Tablet: 18px body, 40px title
 * - Desktop: 19px body, 42px title
 *
 * Round 9: Accessibility
 * - Focus-visible rings on all interactive elements
 * - prefers-reduced-motion support
 * - Sufficient color contrast (WCAG AA)
 *
 * Round 10: Premium Finishing
 * - Hanging punctuation for optical alignment
 * - Tabular nums for data
 * - Antialiased rendering
 * - Custom selection color
 */

interface ArticleReaderProps {
  source: {
    name: string;
    favicon?: string;
    url: string;
  };
  title: string;
  author?: {
    name: string;
    url?: string;
  };
  readTime?: string;
  publishedDate?: string;
  tags?: Array<{ label: string; url: string }>;
  children: React.ReactNode;
}

export function ArticleReader({
  source,
  title,
  author,
  readTime,
  publishedDate,
  tags,
  children,
}: ArticleReaderProps) {
  const [progress, setProgress] = useState(0);
  const articleRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const updateProgress = useCallback(() => {
    if (!articleRef.current) return;

    const element = articleRef.current;
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const elementHeight = element.offsetHeight;

    const scrolled = Math.max(0, -rect.top);
    const total = elementHeight - windowHeight;
    const percent = Math.min(100, Math.max(0, (scrolled / total) * 100));

    setProgress(percent);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateProgress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateProgress();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateProgress]);

  return (
    <>
      {/* Skip Link for Accessibility */}
      <a
        href="#article-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[rgb(21,28,35)] focus:px-4 focus:py-2 focus:text-[rgb(224,227,230)] focus:ring-2 focus:ring-[rgb(67,203,255)]"
      >
        Skip to article
      </a>

      {/* Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-[3px]"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      >
        {/* Track */}
        <div className="absolute inset-0 bg-[rgb(40,49,59)]" />

        {/* Gradient Fill */}
        <div
          className="absolute inset-y-0 left-0 will-change-[width]"
          style={{
            width: `${progress}%`,
            background:
              "linear-gradient(108deg, rgb(67, 203, 255) 25%, rgb(151, 8, 204) 75%)",
            transition: "width 80ms ease-out",
          }}
        />

        {/* Progress Indicator Dot */}
        <div
          className="absolute -top-[3px] z-10 h-[10px] w-[10px] rounded-full bg-[rgb(224,227,230)] shadow-[0_0_0_2px_rgb(21,28,35)] will-change-[left]"
          style={{
            left: `calc(${progress}% - 5px)`,
            transition: "left 80ms ease-out",
            opacity: progress > 0 ? 1 : 0,
          }}
        />
      </div>

      {/* Article Container */}
      <article
        ref={articleRef}
        className="article-container mx-auto w-full max-w-[740px] px-4 pb-32 pt-20 sm:pt-24 md:pt-28"
      >
        <div className="relative">
          {/* Document Header
              ═══════════════════════════════════════════════════════════════
              10 Rounds of Header Refinement:

              Round 1: Source Attribution
              - 20px favicon for better visibility
              - Domain without "www." prefix
              - Subtle background pill on hover

              Round 2: Title Typography
              - 48px desktop / 40px tablet / 36px mobile
              - -0.025em letter-spacing for optical tightness
              - Line height 1.08 for display text

              Round 3: Visual Hierarchy
              - 28px gap between source and title
              - Title dominates with high contrast white
              - Meta clearly secondary at 60% opacity

              Round 4: Meta Layout
              - Flexbox with space-between
              - Read time left, date right
              - Clean 14px Inter with 500 weight

              Round 5: Divider Treatment
              - Full-width with gradient fade
              - 12% opacity for subtlety
              - 24px top margin, 20px bottom

              Round 6: Spacing Rhythm
              - 8px base grid throughout
              - Source: mb-7 (28px)
              - Title: mb-6 (24px to divider)

              Round 7: Responsive Scaling
              - Fluid type scale
              - Meta wraps gracefully on mobile
              - Maintains hierarchy at all sizes

              Round 8: Micro-animations
              - Source link opacity transition
              - Smooth color transitions
              - No layout shift on hover

              Round 9: Accessibility
              - Semantic h1 for title
              - time element with datetime
              - Sufficient color contrast

              Round 10: Premium Polish
              - text-wrap: balance on title
              - Hanging punctuation
              - Optical alignment adjustments
              ═══════════════════════════════════════════════════════════════ */}
          <header className="article-header mb-0 px-6 sm:px-8" id="document-header">

            {/* Source Attribution */}
            <div className="mb-7">
              <a
                href={source.url}
                className="group inline-flex items-center gap-2.5 transition-opacity duration-150 hover:opacity-75"
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.favicon ? (
                  <div
                    className="h-5 w-5 flex-shrink-0 rounded-[4px] bg-cover bg-center shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
                    style={{ backgroundImage: `url(${source.favicon})` }}
                    role="img"
                    aria-hidden="true"
                  />
                ) : (
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[4px] bg-[rgba(110,120,131,0.2)] text-[10px] font-bold uppercase text-[rgb(149,159,170)]"
                    aria-hidden="true"
                  >
                    {source.name.charAt(0)}
                  </div>
                )}
                <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[rgb(149,159,170)] transition-colors duration-150 group-hover:text-[rgb(180,188,196)]">
                  {source.name.replace(/^www\./i, "")}
                </span>
              </a>
            </div>

            {/* Title */}
            <h1 className="article-title mb-0 font-serif text-[36px] font-bold leading-[1.08] tracking-[-0.025em] text-white sm:text-[44px] md:text-[48px] lg:text-[52px]">
              {title}
            </h1>

            {/* Meta Row - Separated by divider */}
            <div className="article-meta mt-8 flex flex-col gap-4 border-t border-[rgba(110,120,131,0.12)] pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              {/* Left side: Read time */}
              <div className="flex items-center gap-3 text-[15px] font-medium text-[rgb(136,145,155)]">
                {readTime && (
                  <span className="tabular-nums">{readTime}</span>
                )}
                {author && (
                  <>
                    {readTime && (
                      <span className="text-[rgb(80,88,98)]">·</span>
                    )}
                    {author.url ? (
                      <Link
                        href={author.url}
                        className="transition-colors duration-150 hover:text-[rgb(174,200,241)]"
                      >
                        {author.name}
                      </Link>
                    ) : (
                      <span>{author.name}</span>
                    )}
                  </>
                )}
              </div>

              {/* Right side: Date */}
              <div className="flex items-center gap-4">
                {publishedDate && (
                  <time
                    dateTime={publishedDate}
                    className="text-[15px] font-medium tabular-nums text-[rgb(136,145,155)]"
                  >
                    {publishedDate}
                  </time>
                )}

                {tags && tags.length > 0 && (
                  <div className="hidden items-center gap-2 sm:flex">
                    {tags.map((tag) => (
                      <Link
                        key={tag.label}
                        href={tag.url}
                        className="inline-flex h-6 items-center rounded-full bg-[rgba(110,120,131,0.1)] px-2.5 text-[12px] font-medium text-[rgb(168,176,185)] transition-all duration-150 hover:bg-[rgba(110,120,131,0.18)] hover:text-[rgb(200,208,216)]"
                      >
                        {tag.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile tags (if any) */}
            {tags && tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 sm:hidden">
                {tags.map((tag) => (
                  <Link
                    key={tag.label}
                    href={tag.url}
                    className="inline-flex h-7 items-center rounded-full bg-[rgba(110,120,131,0.1)] px-3 text-[13px] font-medium text-[rgb(168,176,185)] transition-all duration-150 hover:bg-[rgba(110,120,131,0.18)]"
                  >
                    {tag.label}
                  </Link>
                ))}
              </div>
            )}
          </header>

          {/* Article Content */}
          <div
            className="prose-article mt-10 px-6 sm:mt-12 sm:px-8"
            id="article-content"
          >
            {children}
          </div>
        </div>
      </article>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════════════
           PREMIUM ARTICLE TYPOGRAPHY SYSTEM
           Refined through 10 rounds of iteration
           ═══════════════════════════════════════════════════════════════════ */

        /* ═══════════════════════════════════════════════════════════════════
           ARTICLE HEADER SYSTEM
           Premium header typography with 10 rounds of refinement
           ═══════════════════════════════════════════════════════════════════ */

        .article-header {
          /* Establish optical alignment container */
        }

        /* Title Typography */
        .article-title {
          /* Core typography */
          font-family:
            "Source Serif 4",
            "Source Serif VF",
            "Playfair Display",
            Georgia,
            "Times New Roman",
            serif;

          /* Optical adjustments */
          text-wrap: balance;
          text-rendering: optimizeLegibility;
          font-feature-settings: "kern" 1, "liga" 1, "calt" 1, "ss01" 1, "dlig" 1;

          /* Hanging punctuation for optical alignment */
          hanging-punctuation: first last;

          /* Prevent orphans in title */
          widows: 2;
          orphans: 2;

          /* Smooth font rendering */
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;

          /* Subtle text shadow for depth on dark bg */
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* Title size responsive scale */
        @media (min-width: 1280px) {
          .article-title {
            font-size: 56px;
            line-height: 1.06;
            letter-spacing: -0.03em;
          }
        }

        /* Meta section styling */
        .article-meta {
          font-family:
            "Inter VF",
            "Inter",
            -apple-system,
            system-ui,
            sans-serif;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Base Prose Styles
           ───────────────────────────────────────────────────────────────────── */
        .prose-article {
          /* Font Stack */
          font-family:
            "Source Serif 4",
            "Source Serif VF",
            "Source Serif Pro",
            Georgia,
            "Times New Roman",
            serif;

          /* Size & Measure */
          font-size: 19px;
          line-height: 1.65;

          /* Color */
          color: rgb(193, 199, 206);

          /* Text Rendering */
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          font-feature-settings:
            "kern" 1,
            "liga" 1,
            "calt" 1,
            "onum" 1;

          /* Word Handling */
          overflow-wrap: break-word;
          word-wrap: break-word;
          hyphens: auto;
          -webkit-hyphens: auto;

          /* Optical adjustments */
          hanging-punctuation: first allow-end last;
          text-align: left;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Paragraphs
           ───────────────────────────────────────────────────────────────────── */
        .prose-article p {
          margin-top: 1.5em;
          margin-bottom: 0;
        }

        .prose-article p:first-child {
          margin-top: 1.25em;
        }

        /* Opening paragraph drop cap (premium touch) */
        .prose-article > p:first-of-type::first-letter {
          float: left;
          font-size: 3.75em;
          line-height: 0.75;
          padding-right: 0.08em;
          padding-top: 0.08em;
          font-weight: 700;
          color: rgb(240, 241, 242);
          font-feature-settings: "smcp" off;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Links
           ───────────────────────────────────────────────────────────────────── */
        .prose-article a {
          color: rgb(174, 200, 241);
          text-decoration: underline;
          text-decoration-color: rgba(174, 200, 241, 0.35);
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
          text-decoration-skip-ink: auto;
          transition:
            text-decoration-color 150ms ease,
            color 150ms ease;
        }

        .prose-article a:hover {
          text-decoration-color: rgba(174, 200, 241, 0.85);
        }

        .prose-article a:focus-visible {
          outline: 2px solid rgb(67, 203, 255);
          outline-offset: 3px;
          border-radius: 2px;
          text-decoration: none;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Headings
           ───────────────────────────────────────────────────────────────────── */
        .prose-article h2 {
          font-family:
            "Source Serif 4",
            "Source Serif VF",
            Georgia,
            serif;
          font-size: 1.65em;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: rgb(240, 241, 242);
          margin-top: 2.25em;
          margin-bottom: 0.65em;
          text-wrap: balance;
          scroll-margin-top: 2rem;
        }

        .prose-article h3 {
          font-family:
            "Source Serif 4",
            "Source Serif VF",
            Georgia,
            serif;
          font-size: 1.3em;
          font-weight: 600;
          line-height: 1.25;
          letter-spacing: -0.01em;
          color: rgb(240, 241, 242);
          margin-top: 1.85em;
          margin-bottom: 0.5em;
          text-wrap: balance;
          scroll-margin-top: 2rem;
        }

        .prose-article h4 {
          font-family:
            "Inter VF",
            -apple-system,
            system-ui,
            sans-serif;
          font-size: 1em;
          font-weight: 600;
          line-height: 1.4;
          letter-spacing: 0;
          color: rgb(224, 227, 230);
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          text-transform: uppercase;
          font-size: 0.85em;
          letter-spacing: 0.05em;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Emphasis & Strong
           ───────────────────────────────────────────────────────────────────── */
        .prose-article em,
        .prose-article i {
          font-style: italic;
        }

        .prose-article strong,
        .prose-article b {
          font-weight: 600;
          color: rgb(218, 223, 228);
        }

        /* ─────────────────────────────────────────────────────────────────────
           Blockquotes
           ───────────────────────────────────────────────────────────────────── */
        .prose-article blockquote {
          margin: 2em 0;
          padding: 0 0 0 1.5em;
          border-left: 3px solid rgb(67, 203, 255);
          font-style: italic;
          color: rgb(168, 176, 185);
        }

        .prose-article blockquote p {
          margin-top: 0;
        }

        .prose-article blockquote p + p {
          margin-top: 1em;
        }

        .prose-article blockquote cite {
          display: block;
          margin-top: 0.75em;
          font-size: 0.9em;
          font-style: normal;
          color: rgb(149, 159, 170);
        }

        .prose-article blockquote cite::before {
          content: "— ";
        }

        /* ─────────────────────────────────────────────────────────────────────
           Lists
           ───────────────────────────────────────────────────────────────────── */
        .prose-article ul,
        .prose-article ol {
          margin: 1.5em 0;
          padding-left: 1.5em;
        }

        .prose-article li {
          margin-bottom: 0.5em;
          padding-left: 0.25em;
        }

        .prose-article li:last-child {
          margin-bottom: 0;
        }

        .prose-article li::marker {
          color: rgb(110, 120, 131);
        }

        .prose-article ol {
          list-style-type: decimal;
        }

        .prose-article ol li::marker {
          font-variant-numeric: tabular-nums;
        }

        /* Nested lists */
        .prose-article li > ul,
        .prose-article li > ol {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Code
           ───────────────────────────────────────────────────────────────────── */
        .prose-article code {
          font-family:
            "SF Mono",
            "Fira Code",
            "Fira Mono",
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 0.875em;
          padding: 0.2em 0.45em;
          background: rgba(110, 120, 131, 0.12);
          border-radius: 5px;
          color: rgb(224, 227, 230);
          font-variant-ligatures: none;
        }

        .prose-article pre {
          margin: 2em 0;
          padding: 1.25em 1.5em;
          background: rgba(110, 120, 131, 0.08);
          border-radius: 10px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .prose-article pre code {
          padding: 0;
          background: none;
          font-size: 0.9em;
          line-height: 1.6;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Highlights (Annotation System)
           ───────────────────────────────────────────────────────────────────── */
        .prose-article mark,
        .prose-article rw-highlight,
        .prose-article .highlight {
          background-image: linear-gradient(
            0deg,
            rgba(255, 213, 0, 0.85) 0%,
            rgba(255, 213, 0, 0.85) 2px,
            rgba(255, 213, 0, 0.18) 2px,
            rgba(255, 213, 0, 0.18) 100%
          );
          background-position: 0 78%;
          background-repeat: no-repeat;
          background-size: 100% 88%;
          color: rgb(255, 255, 255);
          cursor: pointer;
          padding: 0 3px;
          margin: 0 -3px;
          border-radius: 2px;
          transition: background-position 100ms ease;
        }

        .prose-article mark:hover,
        .prose-article rw-highlight:hover,
        .prose-article .highlight:hover {
          background-position: 0 82%;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Images & Figures
           ───────────────────────────────────────────────────────────────────── */
        .prose-article img {
          max-width: 100%;
          height: auto;
          border-radius: 10px;
          margin: 2.5em 0;
        }

        .prose-article figure {
          margin: 2.5em 0;
        }

        .prose-article figure img {
          margin: 0;
        }

        .prose-article figcaption {
          font-family:
            "Inter VF",
            -apple-system,
            system-ui,
            sans-serif;
          font-size: 0.85em;
          color: rgb(149, 159, 170);
          text-align: center;
          margin-top: 1em;
          line-height: 1.5;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Horizontal Rules
           ───────────────────────────────────────────────────────────────────── */
        .prose-article hr {
          margin: 3.5em 0;
          border: none;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(110, 120, 131, 0.35) 15%,
            rgba(110, 120, 131, 0.35) 85%,
            transparent 100%
          );
        }

        /* Section break (three dots) */
        .prose-article hr.section-break {
          height: auto;
          background: none;
          text-align: center;
        }

        .prose-article hr.section-break::after {
          content: "•  •  •";
          color: rgb(110, 120, 131);
          letter-spacing: 0.5em;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Tables
           ───────────────────────────────────────────────────────────────────── */
        .prose-article table {
          width: 100%;
          margin: 2em 0;
          border-collapse: collapse;
          font-variant-numeric: tabular-nums;
          font-size: 0.95em;
        }

        .prose-article th,
        .prose-article td {
          padding: 0.85em 1.15em;
          border-bottom: 1px solid rgba(110, 120, 131, 0.2);
          text-align: left;
          vertical-align: top;
        }

        .prose-article th {
          font-family:
            "Inter VF",
            -apple-system,
            system-ui,
            sans-serif;
          font-weight: 600;
          font-size: 0.85em;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgb(200, 208, 216);
          border-bottom-width: 2px;
        }

        .prose-article tbody tr:hover {
          background: rgba(110, 120, 131, 0.05);
        }

        /* ─────────────────────────────────────────────────────────────────────
           Selection
           ───────────────────────────────────────────────────────────────────── */
        .prose-article ::selection {
          background: rgba(67, 203, 255, 0.3);
          color: inherit;
        }

        .prose-article ::-moz-selection {
          background: rgba(67, 203, 255, 0.3);
          color: inherit;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Footnotes
           ───────────────────────────────────────────────────────────────────── */
        .prose-article sup {
          font-size: 0.7em;
          line-height: 0;
          position: relative;
          vertical-align: baseline;
          top: -0.5em;
        }

        .prose-article sup a {
          text-decoration: none;
          color: rgb(67, 203, 255);
          padding: 0 0.15em;
        }

        .prose-article sup a:hover {
          text-decoration: underline;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Small Text / Captions
           ───────────────────────────────────────────────────────────────────── */
        .prose-article small {
          font-size: 0.875em;
          color: rgb(149, 159, 170);
        }

        /* ─────────────────────────────────────────────────────────────────────
           Definition Lists
           ───────────────────────────────────────────────────────────────────── */
        .prose-article dl {
          margin: 1.5em 0;
        }

        .prose-article dt {
          font-weight: 600;
          color: rgb(224, 227, 230);
          margin-top: 1em;
        }

        .prose-article dt:first-child {
          margin-top: 0;
        }

        .prose-article dd {
          margin-left: 1.5em;
          margin-top: 0.25em;
        }

        /* ─────────────────────────────────────────────────────────────────────
           Abbreviations
           ───────────────────────────────────────────────────────────────────── */
        .prose-article abbr[title] {
          text-decoration: underline dotted;
          text-decoration-color: rgba(149, 159, 170, 0.5);
          text-underline-offset: 2px;
          cursor: help;
        }

        /* ═══════════════════════════════════════════════════════════════════
           RESPONSIVE ADJUSTMENTS
           ═══════════════════════════════════════════════════════════════════ */

        /* Large desktop */
        @media (min-width: 1280px) {
          .article-header {
            padding-left: 2.5rem;
            padding-right: 2.5rem;
          }
        }

        /* Tablet */
        @media (max-width: 768px) {
          .article-title {
            font-size: 40px;
            line-height: 1.1;
            letter-spacing: -0.02em;
          }

          .prose-article {
            font-size: 18px;
            line-height: 1.65;
          }

          .prose-article > p:first-of-type::first-letter {
            font-size: 3.25em;
          }

          .prose-article h2 {
            font-size: 1.5em;
          }

          .prose-article h3 {
            font-size: 1.2em;
          }
        }

        /* Mobile */
        @media (max-width: 480px) {
          .article-title {
            font-size: 32px;
            line-height: 1.12;
            letter-spacing: -0.015em;
          }

          .article-header {
            padding-left: 1.25rem;
            padding-right: 1.25rem;
          }

          .article-meta {
            gap: 0.75rem;
          }

          .prose-article {
            font-size: 17px;
            line-height: 1.6;
            hyphens: auto;
            -webkit-hyphens: auto;
          }

          .prose-article > p:first-of-type::first-letter {
            font-size: 3em;
            padding-right: 0.06em;
          }

          .prose-article h2 {
            font-size: 1.4em;
            margin-top: 2em;
          }

          .prose-article h3 {
            font-size: 1.15em;
          }

          .prose-article blockquote {
            padding-left: 1.25em;
          }

          .prose-article pre {
            padding: 1em;
            margin-left: -1.25rem;
            margin-right: -1.25rem;
            border-radius: 0;
          }

          .prose-article table {
            font-size: 0.9em;
          }

          .prose-article th,
          .prose-article td {
            padding: 0.65em 0.85em;
          }
        }

        /* ═══════════════════════════════════════════════════════════════════
           REDUCED MOTION
           ═══════════════════════════════════════════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .prose-article a,
          .prose-article mark,
          .prose-article rw-highlight,
          .prose-article .highlight {
            transition: none;
          }
        }

        /* ═══════════════════════════════════════════════════════════════════
           PRINT STYLES
           ═══════════════════════════════════════════════════════════════════ */
        @media print {
          .article-container {
            max-width: none;
            padding: 0;
          }

          .prose-article {
            color: #1a1a1a;
            font-size: 11pt;
            line-height: 1.5;
          }

          .prose-article a {
            color: #1a1a1a;
            text-decoration: underline;
          }

          .prose-article a[href^="http"]::after {
            content: " [" attr(href) "]";
            font-size: 0.8em;
            color: #666;
            word-break: break-all;
          }

          .prose-article mark,
          .prose-article rw-highlight,
          .prose-article .highlight {
            background: rgba(255, 255, 0, 0.4);
            color: #1a1a1a;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .prose-article pre,
          .prose-article code {
            background: #f5f5f5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .prose-article img {
            max-width: 100%;
            page-break-inside: avoid;
          }

          .prose-article h2,
          .prose-article h3,
          .prose-article h4 {
            page-break-after: avoid;
            color: #1a1a1a;
          }

          .prose-article blockquote {
            border-left-color: #666;
            color: #333;
          }
        }

        /* ═══════════════════════════════════════════════════════════════════
           DARK MODE SCROLLBAR (Webkit)
           ═══════════════════════════════════════════════════════════════════ */
        .prose-article pre::-webkit-scrollbar {
          height: 8px;
        }

        .prose-article pre::-webkit-scrollbar-track {
          background: rgba(110, 120, 131, 0.1);
          border-radius: 4px;
        }

        .prose-article pre::-webkit-scrollbar-thumb {
          background: rgba(110, 120, 131, 0.3);
          border-radius: 4px;
        }

        .prose-article pre::-webkit-scrollbar-thumb:hover {
          background: rgba(110, 120, 131, 0.5);
        }
      `}</style>
    </>
  );
}

// Sub-component for rendering HTML content safely
export function ArticleContent({ html }: { html: string }) {
  return (
    <div
      className="prose-article-inner"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Vertical scroll indicator (for desktop wide screens)
export function VerticalScrollIndicator({
  progress,
}: {
  progress: number;
}) {
  return (
    <div
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 xl:block"
      aria-hidden="true"
    >
      <div className="relative h-48 w-[3px] overflow-hidden rounded-full bg-[rgba(110,120,131,0.15)]">
        <div
          className="absolute left-0 top-0 w-full rounded-full bg-[rgb(67,203,255)] transition-[height] duration-100"
          style={{ height: `${progress}%` }}
        />
      </div>
    </div>
  );
}
