/**
 * Determines if the client prefers Markdown over HTML based on the Accept header.
 *
 * Parses quality values per RFC 7231. Returns true when:
 * - text/markdown has higher quality than text/html
 * - text/plain has higher quality than text/html (or text/html is absent)
 * - text/markdown or text/plain is present without text/html
 *
 * Returns false for wildcard-only headers or when text/html has
 * higher or equal quality to any markdown/plain types.
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
 */
function getQuality(accept: string, mimeType: string): number {
  const index = accept.indexOf(mimeType);
  if (index === -1) return -1;

  // Look for ;q= after the MIME type
  const afterType = accept.slice(index + mimeType.length);
  const qMatch = afterType.match(/^\s*;\s*q\s*=\s*([01](?:\.\d{1,3})?)/);
  return qMatch ? parseFloat(qMatch[1]) : 1.0;
}
