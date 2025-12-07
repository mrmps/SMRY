import { z } from "zod";
import isURL, { IsURLOptions } from "validator/lib/isURL";

// Valid protocol: http:// or https://
const VALID_PROTOCOL_REGEX = /^https?:\/\//;

const URL_VALIDATION_OPTIONS: IsURLOptions = {
  protocols: ["http", "https"],
  require_protocol: true,
  allow_query_components: true,
  allow_fragments: true,
  allow_underscores: true,
  require_host: true,
  require_valid_protocol: true,
  allow_protocol_relative_urls: false,
  disallow_auth: false,
};

/**
 * Clean up malformed URL protocols.
 * Handles cases like:
 * - "https://https:/example.com" -> "https://example.com"
 * - "https:/example.com" -> "https://example.com"
 * - "http://http://example.com" -> "http://example.com"
 */
function cleanProtocol(url: string): string {
  let result = url;

  // Remove duplicate protocols (e.g., "https://https://" or "https://http://")
  // Keep removing until no more duplicates
  let previous: string;
  do {
    previous = result;
    // Match: protocol://protocol: and keep just the second protocol
    result = result.replace(/^https?:\/\/(https?:\/?\/?)/i, "$1");
  } while (previous !== result);

  // Fix malformed single-slash protocols: "https:/x" -> "https://x"
  result = result.replace(/^(https?:\/)([^/])/i, "$1/$2");

  return result;
}

/**
 * Normalize user-provided URLs by ensuring they include a protocol.
 * Accepts inputs with or without http(s) and validates using validator.js.
 * Handles malformed protocols like "https:/" and duplicates like "https://https://".
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Please enter a URL.");
  }

  // Clean up any protocol issues first
  let candidate = cleanProtocol(trimmed);

  // Add protocol if missing
  if (!VALID_PROTOCOL_REGEX.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  if (!isURL(candidate, URL_VALIDATION_OPTIONS)) {
    throw new Error("Please enter a valid URL (e.g. example.com or https://example.com).");
  }

  return candidate;
}

/**
 * Quick helper to check if a string is a valid URL after normalization.
 */
export function isValidUrl(input: string): boolean {
  try {
    normalizeUrl(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Zod schema that normalizes and validates URLs consistently on both
 * the client and server.
 */
export const NormalizedUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .transform((value, ctx) => {
    try {
      return normalizeUrl(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error
            ? error.message
            : "Please enter a valid URL.",
      });
      return z.NEVER;
    }
  });




