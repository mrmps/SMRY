"use client";

import showdown from "showdown";

const converter = new showdown.Converter();

export interface JinaArticle {
  title: string;
  content: string;
  textContent: string;
  length: number;
  siteName: string;
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
    let contentStartIndex = 4; // Default
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].startsWith("URL Source:")) {
        urlSourceLine = lines[i].replace("URL Source: ", "").trim();
        // Content typically starts a few lines after URL Source
        contentStartIndex = i + 2;
        
        // Check if there's a Published Time line
        if (lines[i + 2]?.startsWith("Published Time:")) {
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

    // Convert markdown to HTML
    const contentHtml = converter.makeHtml(mainContent);

    const article: JinaArticle = {
      title: title,
      content: contentHtml,
      textContent: mainContent,
      length: mainContent.length,
      siteName: extractHostname(urlSource),
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

