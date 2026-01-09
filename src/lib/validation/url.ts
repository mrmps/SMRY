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

// Block self-referential URLs, localhost variants, and cloud metadata endpoints
// to prevent recursive loops and SSRF attacks
const BLOCKED_HOSTNAMES = new Set([
  // Self-referential
  "smry.ai",
  "www.smry.ai",
  // Localhost variants
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  // IPv6-mapped IPv4 localhost
  "::ffff:127.0.0.1",
  "[::ffff:127.0.0.1]",
  // Cloud metadata endpoints (AWS, GCP, Azure, etc.)
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
  // Kubernetes internal
  "kubernetes.default",
  "kubernetes.default.svc",
]);

/**
 * Check if an IP address is in a private/internal range.
 * This catches SSRF attempts using raw IP addresses.
 */
function isPrivateIP(hostname: string): boolean {
  // Remove brackets from IPv6
  const cleanHost = hostname.replace(/^\[|\]$/g, "");

  // IPv4 private ranges
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(cleanHost);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);
    // Validate octets
    if ([a, b, c, d].some(n => n > 255)) return false;

    // 10.0.0.0/8 - Private
    if (a === 10) return true;
    // 172.16.0.0/12 - Private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 - Private
    if (a === 192 && b === 168) return true;
    // 127.0.0.0/8 - Loopback
    if (a === 127) return true;
    // 169.254.0.0/16 - Link-local (includes AWS metadata)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8 - Current network
    if (a === 0) return true;
  }

  // IPv6 private/special ranges
  if (cleanHost.includes(":")) {
    const lower = cleanHost.toLowerCase();
    // Loopback
    if (lower === "::1") return true;
    // Link-local
    if (lower.startsWith("fe80:")) return true;
    // Unique local (private)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // IPv4-mapped IPv6 (check if the mapped IPv4 is private)
    const mappedMatch = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
    if (mappedMatch) {
      return isPrivateIP(mappedMatch[1]);
    }
  }

  return false;
}

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

  // Block self-referential URLs, internal hosts, and private IPs to prevent SSRF
  try {
    const hostname = new URL(candidate).hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      throw new Error("Cannot summarize SMRY URLs. Please enter the original article URL.");
    }
    // Check for private/internal IP addresses
    if (isPrivateIP(hostname)) {
      throw new Error("Cannot access internal or private network addresses.");
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("SMRY") || e.message.includes("internal"))) throw e;
    // URL parsing failed - let it through, will fail later with better error
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
