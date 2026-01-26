"use client";

import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

export interface JinaArticle {
  title: string;
  content: string;
  textContent: string;
  length: number;
  siteName: string;
  publishedTime?: string | null;
}

export interface JinaError {
  message: string;
  status?: number;
}

// Common selectors to remove navigation, footers, sidebars, and other non-content elements
const REMOVE_SELECTORS = [
  "nav",
  "header",
  "footer",
  ".nav",
  ".navigation",
  ".sidebar",
  ".menu",
  ".site-nav",
  ".site-header",
  ".site-footer",
  "#nav",
  "#navigation",
  "#sidebar",
  "#menu",
  "#header",
  "#footer",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  ".share-buttons",
  ".social-share",
  ".related-articles",
  ".recommended",
  ".newsletter-signup",
  ".subscribe",
  ".advertisement",
  ".ad",
  ".ads",
].join(",");

// Target selectors for main content (in order of preference)
const TARGET_SELECTORS = [
  "article",
  "[role='main']",
  "main",
  ".article-content",
  ".post-content",
  ".entry-content",
  ".content",
  "#article",
  "#content",
].join(",");

/**
 * Fetch and parse article from Jina.ai (client-side)
 * Returns parsed article or error
 */
export async function fetchJinaArticle(
  url: string
): Promise<{ article: JinaArticle } | { error: JinaError }> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: {
        "Accept": "application/json",
        "X-No-Cache": "true",
        "X-Remove-Selector": REMOVE_SELECTORS,
        "X-Target-Selector": TARGET_SELECTORS,
        "X-With-Generated-Alt": "true",
      },
    });

    if (!response.ok) {
      return {
        error: {
          message: `HTTP error! status: ${response.status}`,
          status: response.status,
        },
      };
    }

    const contentType = response.headers.get("content-type") || "";

    // Handle JSON response format
    if (contentType.includes("application/json")) {
      const json = await response.json();
      const mainContent = cleanContent(json.content || "");
      const contentHtml = await convertMarkdownToHtml(mainContent);

      const article: JinaArticle = {
        title: json.title || "Untitled",
        content: contentHtml,
        textContent: mainContent,
        length: mainContent.length,
        siteName: extractHostname(json.url || url),
        publishedTime: json.publishedTime || null,
      };

      return { article };
    }

    // Fallback to markdown parsing
    const markdown = await response.text();
    const lines = markdown.split("\n");

    // Extract title, URL source, and main content from Jina.ai markdown format
    const title = lines[0]?.replace("Title: ", "").trim() || "Untitled";

    // Find the URL Source line
    let urlSourceLine = "";
    let publishedTime = null;
    let contentStartIndex = 4; // Default

    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].startsWith("URL Source:")) {
        urlSourceLine = lines[i].replace("URL Source: ", "").trim();
        contentStartIndex = i + 2;

        if (lines[i + 2]?.startsWith("Published Time:")) {
          publishedTime = lines[i + 2].replace("Published Time: ", "").trim();
          contentStartIndex = i + 4;
        }

        if (lines[contentStartIndex]?.includes("Markdown Content:")) {
          contentStartIndex++;
        }

        break;
      }
    }

    const urlSource = urlSourceLine || url;
    const mainContent = cleanContent(lines.slice(contentStartIndex).join("\n").trim());
    const contentHtml = await convertMarkdownToHtml(mainContent);

    const article: JinaArticle = {
      title: title,
      content: contentHtml,
      textContent: mainContent,
      length: mainContent.length,
      siteName: extractHostname(urlSource),
      publishedTime: publishedTime,
    };

    return { article };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : "Failed to fetch from Jina.ai",
      },
    };
  }
}

/**
 * Clean content by removing navigation remnants and handling images
 */
function cleanContent(content: string): string {
  let cleaned = content;

  // Remove common navigation patterns that slip through
  const navPatterns = [
    /^(Skip to content|Site Navigation|Popular|Latest|Newsletters?|Sections?)\s*$/gim,
    /^\*\s*\[[\w\s]+\]\([^)]+\)\s*$/gm, // Navigation link lists like "* [Politics](url)"
    /^(Quick Links|Related Articles?|More from|You might also like)\s*$/gim,
    /^(Share|Follow us|Subscribe|Sign up)\s*$/gim,
    /^Image \d+:?\s*$/gim, // Standalone "Image 1:" lines
    /^\*Image \d+[^*]*\*[^*]*$/gm, // "*Image 1: alt*text" patterns
  ];

  for (const pattern of navPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Collapse multiple consecutive blank lines into a single one
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract hostname from URL safely
 */
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

async function convertMarkdownToHtml(markdown: string): Promise<string> {
  try {
    const html = marked.parse(markdown);
    return typeof html === "string" ? html : "";
  } catch (error) {
    console.warn("Failed to convert markdown via marked, falling back to plain text.", error);
    return fallbackHtmlFromPlainText(markdown);
  }
}

function fallbackHtmlFromPlainText(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .split(/\n{2,}/)
    .map((chunk) => `<p>${chunk.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

