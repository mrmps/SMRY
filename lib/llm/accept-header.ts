/**
 * Determines if the client prefers Markdown over HTML based on the Accept header.
 *
 * Returns true when:
 * - Accept contains text/markdown (regardless of position)
 * - Accept contains text/plain before text/html, or text/plain without text/html
 */
export function prefersMarkdown(accept: string): boolean {
  if (!accept) return false;

  const lower = accept.toLowerCase();

  const markdownIndex = lower.indexOf("text/markdown");
  const plainIndex = lower.indexOf("text/plain");
  const htmlIndex = lower.indexOf("text/html");

  // text/markdown present and before text/html (or text/html absent)
  if (markdownIndex !== -1 && (htmlIndex === -1 || markdownIndex < htmlIndex)) {
    return true;
  }

  // text/plain present and before text/html (or text/html absent)
  if (plainIndex !== -1 && (htmlIndex === -1 || plainIndex < htmlIndex)) {
    return true;
  }

  return false;
}
