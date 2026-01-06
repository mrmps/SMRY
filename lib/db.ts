import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | null = null;
let tableCreated = false;

function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL!);
  }
  return sql;
}

function stripHtml(html: string): string {
  return html
    // Remove script tags and contents
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    // Remove style tags and contents
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    // Remove svg tags and contents
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    // Remove noscript tags and contents
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    // Remove iframe tags
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    // Remove img tags (keep alt text would require more complex parsing)
    .replace(/<img\b[^>]*\/?>/gi, "")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Remove inline style attributes
    .replace(/\s+style\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+style\s*=\s*'[^']*'/gi, "")
    // Remove data-* attributes
    .replace(/\s+data-[\w-]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+data-[\w-]+\s*=\s*'[^']*'/gi, "")
    // Remove event handlers (onclick, onload, etc.)
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, "")
    // Collapse multiple whitespace/newlines
    .replace(/\s+/g, " ")
    .trim();
}

export async function storeArticleHtml(url: string, html: string) {
  try {
    const db = getDb();
    if (!tableCreated) {
      await db`
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL,
          html TEXT NOT NULL,
          fetched_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      tableCreated = true;
    }
    const stripped = stripHtml(html);
    await db`INSERT INTO articles (url, html) VALUES (${url}, ${stripped})`;
  } catch (error) {
    console.error("Failed to store article HTML:", error);
  }
}
