/**
 * Determines if the client prefers Markdown over HTML based on the Accept header.
 *
 * Parses quality values per RFC 7231. Returns true when:
 * - text/markdown has higher quality than text/html
 * - text/plain has higher quality than text/html (or text/html is absent)
 * - text/markdown or text/plain is present without text/html
 *
 * Returns false for wildcard-only headers or when text/html has
 * higher quality. When qualities are equal, position in the header
 * is used as a tiebreaker (earlier type wins).
 */
export function prefersMarkdown(accept: string): boolean {
  if (!accept) return false;

  const lower = accept.toLowerCase();

  // Parse quality values for relevant types
  const markdownQ = getQuality(lower, "text/markdown");
  const plainQ = getQuality(lower, "text/plain");
  const htmlQ = getQuality(lower, "text/html");

  // text/markdown present with higher quality than text/html
  if (markdownQ > 0 && (htmlQ < 0 || markdownQ > htmlQ)) return true;

  // text/plain present with higher quality than text/html (or html absent)
  if (plainQ > 0 && (htmlQ < 0 || plainQ > htmlQ)) return true;

  // When quality values are equal, use position as tiebreaker
  if (markdownQ > 0 && htmlQ > 0 && markdownQ === htmlQ) {
    return lower.indexOf("text/markdown") < lower.indexOf("text/html");
  }
  if (plainQ > 0 && htmlQ > 0 && plainQ === htmlQ) {
    return lower.indexOf("text/plain") < lower.indexOf("text/html");
  }

  return false;
}

/**
 * Extract quality value for a MIME type from an Accept header.
 * Returns -1 if the type is not present, otherwise returns the quality (0-1, default 1.0).
 *
 * Splits the header into comma-separated segments and matches each segment
 * by exact MIME type prefix to avoid substring false positives.
 * Handles media-type parameters (e.g., charset) before the q parameter.
 */
function getQuality(accept: string, mimeType: string): number {
  const segments = accept.split(",");
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed.startsWith(mimeType)) continue;
    // Ensure exact type match (next char must be ';', ' ', or end of string)
    const next = trimmed[mimeType.length];
    if (next !== undefined && next !== ";" && next !== " ") continue;
    // Extract quality from parameters
    const params = trimmed.slice(mimeType.length).split(";");
    for (const param of params) {
      const qMatch = param.trim().match(/^q\s*=\s*([01](?:\.\d{1,3})?)$/);
      if (qMatch) return parseFloat(qMatch[1]);
    }
    return 1.0; // type present, no explicit q → default 1.0
  }
  return -1;
}
