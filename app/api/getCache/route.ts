import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { z } from 'zod';

// Define a schema for known errors
const KnownErrorSchema = z.object({
  message: z.string(),
  status: z.number(),
  error: z.string(),
  details: z.record(z.string()).optional()
});

// Define a schema for unknown errors
const UnknownErrorSchema = z.object({
  message: z.string(),
  error: z.string().optional()
});

const dummy = {
  "title": "Sample Page",
  "byline": null,
  "dir": "ltr",
  "lang": "en",
  "content": "<p>This is some sample content.</p>",
  "textContent": "This is some sample content.",
  "length": 1200,
  "excerpt": "Sample excerpt from the page content.",
  "siteName": "Example Site"
}


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
      error: 'Internal Server Error'
    };
  }

  // If validation fails, log the original error for internal tracking
  console.error('Invalid error object:', error);
  // Return a generic error to the client
  return {
    message: 'An unexpected error occurred.',
    status: 500,
    error: 'Internal Server Error'
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ message: 'URL parameter is required.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  try {
    const googleCacheUrl = `http://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
    console.log(googleCacheUrl)
    const response = await fetch(googleCacheUrl);

    if (!response.ok) {
      return new Response(JSON.stringify(dummy), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
      // throw { message: `Failed to fetch content from Google Cache. Status: ${response.status}`, status: response.status };
    }

    const html = await response.text();
    const doc = new JSDOM(html);
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article) {
      throw { message: 'Failed to extract readable content. The page might not have content in a readable format or might be missing.', status: 422 };
    }

    return new Response(JSON.stringify(article), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const err = safeError(error)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: err.status,
    });
  }
}
