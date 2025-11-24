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

/**
 * Fetch and parse article from Jina.ai (client-side)
 * Returns parsed article or error
 */
export async function fetchJinaArticle(
  url: string
): Promise<{ article: JinaArticle } | { error: JinaError }> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    
    const response = await fetch(jinaUrl);
    
    if (!response.ok) {
      return {
        error: {
          message: `HTTP error! status: ${response.status}`,
          status: response.status,
        },
      };
    }

    const markdown = await response.text();
    const lines = markdown.split("\n");

    // Extract title, URL source, and main content from Jina.ai markdown format
    // Format:
    // Title: <title>
    // 
    // URL Source: <url>
    // 
    // Published Time: <time> (optional)
    // 
    // Markdown Content:
    // <content>
    const title = lines[0]?.replace("Title: ", "").trim() || "Untitled";
    
    // Find the URL Source line
    let urlSourceLine = "";
    let publishedTime = null;
    let contentStartIndex = 4; // Default
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].startsWith("URL Source:")) {
        urlSourceLine = lines[i].replace("URL Source: ", "").trim();
        // Content typically starts a few lines after URL Source
        contentStartIndex = i + 2;
        
        // Check if there's a Published Time line
        if (lines[i + 2]?.startsWith("Published Time:")) {
          publishedTime = lines[i + 2].replace("Published Time: ", "").trim();
          contentStartIndex = i + 4;
        }
        
        // Skip "Markdown Content:" header if present
        if (lines[contentStartIndex]?.includes("Markdown Content:")) {
          contentStartIndex++;
        }
        
        break;
      }
    }
    
    const urlSource = urlSourceLine || url;
    const mainContent = lines.slice(contentStartIndex).join("\n").trim();

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

