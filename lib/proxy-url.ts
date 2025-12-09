import { normalizeUrl } from "@/lib/validation/url";

/**
 * Best-effort decode; if input is not percent-encoded, return as-is.
 */
export function safeDecodeUrl(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Repair cases where a protocol lost one slash (e.g. "https:/example.com").
 */
export function repairProtocolSlashes(value: string): string {
  return value.replace(/^([a-zA-Z][a-zA-Z\d+\-.]*):\/(?!\/)/, "$1://");
}

/**
 * Normalize any user-provided URL-like input into a valid absolute URL.
 */
export function normalizeInputUrl(value: string): string {
  const decoded = safeDecodeUrl(value.trim());
  const repaired = repairProtocolSlashes(decoded);
  return normalizeUrl(repaired);
}

/**
 * Build the internal proxy URL with correct normalization and encoding.
 */
export function buildProxyUrl(input: string): string {
  const normalized = normalizeInputUrl(input);
  return `/proxy?url=${encodeURIComponent(normalized)}`;
}

