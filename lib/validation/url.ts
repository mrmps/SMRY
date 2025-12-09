import { z } from "zod";
import isURL, { IsURLOptions } from "validator/lib/isURL";

const PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

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
 * Best-effort URL decode; returns input as-is if decoding fails.
 */
export function safeDecodeUrl(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Repair collapsed protocols in URL paths.
 * Browsers/servers can collapse "://" to ":/" in paths.
 * e.g., "https:/www.nytimes.com" → "https://www.nytimes.com"
 */
export function repairProtocol(url: string): string {
  return url.replace(/^([a-zA-Z][a-zA-Z\d+\-.]*):\/(?!\/)/, "$1://");
}

/**
 * Normalize user-provided URLs by ensuring they include a protocol.
 * Accepts inputs with or without http(s) and validates using validator.js.
 * Also handles:
 * - Already percent-encoded URLs (decodes first to avoid double-encoding)
 * - Malformed single-slash protocols like "https:/example.com"
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Please enter a URL.");
  }

  // Decode first to handle already-encoded URLs
  const decoded = safeDecodeUrl(trimmed);

  // Repair single-slash protocols
  const repaired = repairProtocol(decoded);

  const candidate = PROTOCOL_REGEX.test(repaired)
    ? repaired
    : `https://${repaired}`;

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
