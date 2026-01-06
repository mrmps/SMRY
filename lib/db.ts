import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | null = null;
let tableCreated = false;

function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL!);
  }
  return sql;
}

// PERF: Precompiled regexes for HTML stripping - avoids recompilation on each call
const STRIP_PATTERNS = {
  // Combined pattern for tags with content that should be removed entirely
  tagsWithContent: /<(script|style|svg|noscript|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi,
  // Self-closing or void tags
  imgTags: /<img\b[^>]*\/?>/gi,
  // HTML comments
  comments: /<!--[\s\S]*?-->/g,
  // Combined pattern for attributes to remove (style, data-*, event handlers)
  unwantedAttrs: /\s+(style|data-[\w-]+|on\w+)\s*=\s*["'][^"']*["']/gi,
  // Collapse whitespace
  whitespace: /\s+/g,
};

/**
 * Strip unnecessary HTML content for storage
 * PERF: Uses precompiled regexes and fewer passes (5 instead of 18)
 */
function stripHtml(html: string): string {
  return html
    .replace(STRIP_PATTERNS.tagsWithContent, "")
    .replace(STRIP_PATTERNS.imgTags, "")
    .replace(STRIP_PATTERNS.comments, "")
    .replace(STRIP_PATTERNS.unwantedAttrs, "")
    .replace(STRIP_PATTERNS.whitespace, " ")
    .trim();
}

/**
 * Store article HTML for training data
 * Fire-and-forget - errors are logged but don't affect request
 */
export async function storeArticleHtml(url: string, html: string) {
  try {
    const db = getDb();
    if (!tableCreated) {
      // PERF: Added index on url for faster lookups
      await db`
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL,
          html TEXT NOT NULL,
          fetched_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      // Create index separately (IF NOT EXISTS for idempotency)
      await db`CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url)`;
      tableCreated = true;
    }
    const stripped = stripHtml(html);
    await db`INSERT INTO articles (url, html) VALUES (${url}, ${stripped})`;
  } catch (error) {
    console.error("Failed to store article HTML:", error);
  }
}
