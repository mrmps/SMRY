import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { z } from "zod";

// Define a schema for known errors
const KnownErrorSchema = z.object({
  message: z.string(),
  status: z.number(),
  error: z.string(),
  details: z.record(z.string()).optional(),
});

// Define a schema for unknown errors
const UnknownErrorSchema = z.object({
  message: z.string(),
  error: z.string().optional(),
});

// The helper function that validates and formats the error response
function safeError(error: unknown) {
  // Check if it is a known error
  const knownErrorResult = KnownErrorSchema.safeParse(error);
  if (knownErrorResult.success) {
    return knownErrorResult.data;
  }

  // If not a known error, check if it is an unknown error with a message
  const unknownErrorResult = UnknownErrorSchema.safeParse(error);
  if (unknownErrorResult.success) {
    return {
      ...unknownErrorResult.data,
      status: 500, // default to 500 if status is not known
      error: "Internal Server Error",
    };
  }

  // If validation fails, log the original error for internal tracking
  console.error("Invalid error object:", error);
  // Return a generic error to the client
  return {
    message: "An unexpected error occurred.",
    status: 500,
    error: "Internal Server Error",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response(
      JSON.stringify({ message: "URL parameter is required." }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }

  const dummy = {
    title: "Sample Page",
    byline: null,
    dir: "ltr",
    lang: "en",
    content: "<p>This is some sample content.</p>",
    textContent: "This is some sample content.",
    length: 1200,
    excerpt: "Sample excerpt from the page content.",
    siteName: "Example Site",
    source: url,
    sourceURL: "",
  };

  const googleCacheUrl = `http://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(
    url
  )}`;
  const waybackUrl = `http://archive.org/wayback/available?url=${encodeURIComponent(
    url
  )}`;
  const archiveIsUrl = `https://archive.is/${encodeURIComponent(url)}`;

  try {
    const responses = await Promise.allSettled([
      // fetchWithEncoding(googleCacheUrl),
      // fetchWithEncoding(waybackUrl),
      // fetchWithEncoding(url),
      fetchWithEncoding(archiveIsUrl),
    ]);
    for (const response of responses) {
      if (response.status === "fulfilled") {
        let { url, html } = response.value;

        let sourceURL = url;
        let source = determineSource(url);

        if (isWaybackMachineResponse(url)) {
          const archiveUrl = getArchiveUrl(html);
          if (archiveUrl) {
            const archiveResponse = await fetchWithEncoding(archiveUrl);
            html = archiveResponse.html;
            sourceURL = archiveUrl; // Update source URL to the actual archive URL
            source = "Wayback Machine"; // Explicitly set the source to Wayback Machine
          } else {
            continue; // Skip if no valid archive
          }
        }

        if (isArchiveIsResponse(response.value.url)) {
          const snapshots = parseArchiveIsResponse(html);
          const latestSnapshotHtml = await fetchLatestSnapshotHtml(snapshots);

          if (latestSnapshotHtml === null) {
            continue; // Skip if no latest snapshot is found
          }

          if (!html) continue; // Skip if no latest snapshot is found
          source = "archive.is";
          sourceURL = response.value.url;
        }

        const doc = new JSDOM(html);
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        if (article) {
          return new Response(
            JSON.stringify({ ...article, source, sourceURL }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }
    }

    // Fallback to dummy response if all requests fail
    return new Response(JSON.stringify({ ...dummy }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const err = safeError(error);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: err.status,
    });
  }
}

interface WaybackResponse {
  archived_snapshots?: {
    [key: string]: any;
  };
}
function getArchiveUrl(responseJson: string): string | null {
  try {
    const parsedJson: WaybackResponse = JSON.parse(responseJson);
    if (
      parsedJson &&
      parsedJson.archived_snapshots &&
      parsedJson.archived_snapshots.closest &&
      parsedJson.archived_snapshots.closest.available
    ) {
      return parsedJson.archived_snapshots.closest.url; // Return the snapshot URL
    }
    return null; // No valid snapshot
  } catch (e) {
    console.error("Error parsing JSON for archive check:", e);
    return null;
  }
}

function determineSource(url: string): string {
  if (url.includes("webcache.googleusercontent.com")) {
    return "Google Cache";
  } else if (url.includes("archive.org")) {
    return "Wayback Machine Original";
  } else {
    return "Direct Fetch";
  }
}

async function fetchWithEncoding(url: string) {
  const googlebotUserAgent =
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

  const response = await fetch(url, {
    headers: {
      "User-Agent": googlebotUserAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("utf-8"); // Assuming UTF-8 encoding
  const html = decoder.decode(buffer);
  return { url, html }; // Return both URL and HTML
}

function isWaybackMachineResponse(url: string) {
  return url.includes("archive.org");
}

function isArchiveIsResponse(url: string) {
  return url.includes("archive.is");
}

function parseArchiveIsResponse(htmlResponse: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlResponse, "text/html");
  const snapshotElements = doc.querySelectorAll(".THUMBS-BLOCK a");

  const snapshots = Array.from(snapshotElements).map((el) => {
    // Type assertion to HTMLAnchorElement
    const anchorEl = el as HTMLAnchorElement;
    return {
      url: anchorEl.href, // Now 'href' is valid
      timestamp: anchorEl.querySelector("div")?.textContent?.trim() || "",
    };
  });

  return snapshots;
}

function findLatestSnapshot(snapshots: any[]) {
  return snapshots.sort((a, b) => {
    // Convert timestamps to Date objects
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);

    // Convert Date objects to timestamps (number format) for subtraction
    return dateB.getTime() - dateA.getTime();
  })[0];
}

async function fetchLatestSnapshotHtml(snapshots: any[]) {
  const latestSnapshot = findLatestSnapshot(snapshots);
  if (!latestSnapshot) {
    return null;
  }

  try {
    const response = await fetch(latestSnapshot.url);
    if (!response.ok) {
      throw new Error("Failed to fetch latest snapshot");
    }

    return await response.text();
  } catch (error) {
    console.error("Error fetching latest snapshot:", error);
    return null;
  }
}

async function fetchAndParse(url: string) {
  try {
    const { html } = await fetchWithEncoding(url);
    const doc = new JSDOM(html).window.document;
    const reader = new Readability(doc);
    return reader.parse();
  } catch (error) {
    console.error(`Error fetching or parsing URL ${url}:`, error);
    return null;
  }
}
