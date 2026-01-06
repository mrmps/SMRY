import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Auto-create table on first use
let tableCreated = false;

async function ensureTable() {
  if (tableCreated) return;
  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL,
      html TEXT NOT NULL,
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  tableCreated = true;
}

export async function storeArticleHtml(url: string, html: string) {
  try {
    await ensureTable();
    await sql`INSERT INTO articles (url, html) VALUES (${url}, ${html})`;
  } catch (error) {
    // Log but don't fail the request
    console.error("Failed to store article HTML:", error);
  }
}
