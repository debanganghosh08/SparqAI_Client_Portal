// Shared plumbing for the command-line scripts. Next.js loads .env.local by
// itself; a bare `node scripts/...` does not, so it is read here.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^(['"])(.*)\1$/, "$2");
  }
}

export const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "\n  DATABASE_URL is not set.\n" +
      "  Supabase: Project Settings -> Database -> Connection string -> Transaction pooler.\n" +
      "  Put it in .env.local as DATABASE_URL=...\n",
  );
  process.exit(1);
}

// BIGINT comes back as a string otherwise; every int8 here is a byte count or
// a millisecond timestamp, both well inside Number.MAX_SAFE_INTEGER.
pg.types.setTypeParser(20, (value) => Number(value));

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 4,
  // Supabase's pooler presents a certificate this client has no root for. The
  // connection is still encrypted; a direct connection keeps full verification.
  ssl: /pooler\.supabase\.com/.test(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
});

export async function q(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0];
}

export async function done() {
  await pool.end();
}
