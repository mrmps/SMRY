import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | null = null;
let tableCreated = false;

function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL!);
  }
  return sql;
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
    await db`INSERT INTO articles (url, html) VALUES (${url}, ${html})`;
  } catch (error) {
    console.error("Failed to store article HTML:", error);
  }
}
