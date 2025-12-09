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
 * Normalize user-provided URLs by ensuring they include a protocol.
 * Accepts inputs with or without http(s) and validates using validator.js.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Please enter a URL.");
  }

  // Browsers or frameworks can collapse "//" in paths (e.g. "https:/example.com").
  // Repair any single-slash protocol so we still treat it as a valid URL.
  const repairedProtocol = trimmed.replace(
    /^([a-zA-Z][a-zA-Z\d+\-.]*):\/(?!\/)/,
    "$1://"
  );

  const candidate = PROTOCOL_REGEX.test(repairedProtocol)
    ? repairedProtocol
    : `https://${repairedProtocol}`;

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




