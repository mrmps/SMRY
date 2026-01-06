import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;
let tableCreated = false;

function getDb() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    sql = neon(url);
  }
  return sql;
}

async function ensureTable(db: NeonQueryFunction<false, false>) {
  if (tableCreated) return;
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

export async function storeArticleHtml(url: string, html: string) {
  try {
    const db = getDb();
    if (!db) return;
    await ensureTable(db);
    await db`INSERT INTO articles (url, html) VALUES (${url}, ${html})`;
  } catch (error) {
    console.error("Failed to store article HTML:", error);
  }
}
