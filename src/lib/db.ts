// The portal's data lives in PostgreSQL (Supabase in production) and its
// uploads in Supabase Storage. It ran on a local SQLite file until 27 Nov
// 2026; the move was forced by Vercel, whose filesystem is read-only and whose
// instances are discarded between requests, so a file-backed database cannot
// survive there at all.
//
// Everything still goes through get/all/run, which now return promises.
// `toPg` below keeps the call sites in SQLite's own dialect - `?` placeholders
// and datetime('now') - so the ninety-odd queries in this app did not have to
// be rewritten one by one, only awaited.
import { Pool, types as pgTypes } from "pg";
import { SCHEMA } from "./schema.mjs";

// pg hands back BIGINT (int8) as a string, because a 64-bit integer does not
// always fit a JS number. Every int8 in this schema is a byte count or a
// millisecond timestamp, both comfortably inside Number.MAX_SAFE_INTEGER, and
// a string here would silently turn `used + file.size` into concatenation.
pgTypes.setTypeParser(20, (value) => Number(value));
// SUM() over a BIGINT column returns NUMERIC, not BIGINT, and pg returns
// NUMERIC as a string too. The per-client disk quota does
// `used + file.size > MAX_USER_BYTES`, which with a string `used` concatenates
// instead of adding and rejects uploads at the wrong size. This schema has no
// NUMERIC columns of its own, so every value of this type is an aggregate.
pgTypes.setTypeParser(1700, (value) => Number(value));

// The pool is built on first use, not on import. A Next build imports every
// route to collect its metadata, and a module that throws without
// DATABASE_URL would make the build itself depend on the database being
// reachable. A missing variable now fails the first query, with the same
// message, where it is actually actionable.
const globalForDb = globalThis as unknown as { __portalPool?: Pool };
let poolRef: Pool | null = globalForDb.__portalPool ?? null;

function getPool(): Pool {
  if (poolRef) return poolRef;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Supabase: Project Settings -> Database -> Connection string -> Transaction pooler.",
    );
  }
  // Supabase's pooler presents a certificate this client has no root for, so
  // verification is off for that host only. The connection is still
  // encrypted. A direct (non-pooler) connection keeps full verification.
  const isSupabasePooler = /pooler\.supabase\.com/.test(connectionString);
  poolRef = new Pool({
    connectionString,
    // Serverless runs many small instances, and a generous pool in each is how
    // a quiet site exhausts a Postgres connection limit.
    max: Number(process.env.PG_POOL_MAX || 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: isSupabasePooler ? { rejectUnauthorized: false } : undefined,
  });
  // A pool emits an error when the server hangs up on an idle client.
  // Unhandled, that takes the process down.
  poolRef.on("error", (error) => console.error("[db] idle client error:", error.message));
  // One pool per process, kept on globalThis so Next's dev server does not
  // leak a new one on every hot reload.
  if (process.env.NODE_ENV !== "production") globalForDb.__portalPool = poolRef;
  return poolRef;
}

/** SQLite's UTC text timestamp, to the second: the format every formatter in
 *  this app expects to read back. */
const PG_NOW = "to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')";

/** Rewrites a SQLite query into the Postgres dialect: `?` becomes `$1`, `$2`
 *  and so on, and datetime('now') becomes its Postgres equivalent. A question
 *  mark inside a string literal is left alone. */
export function toPg(sql: string): string {
  const withNow = sql.split("datetime('now')").join(PG_NOW);
  let out = "";
  let placeholder = 0;
  let inString = false;
  for (let i = 0; i < withNow.length; i += 1) {
    const char = withNow[i];
    if (inString) {
      out += char;
      // '' is an escaped quote inside a literal, not the end of one.
      if (char === "'") {
        if (withNow[i + 1] === "'") {
          out += "'";
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (char === "'") {
      inString = true;
      out += char;
      continue;
    }
    if (char === "?") {
      placeholder += 1;
      out += "$" + placeholder;
      continue;
    }
    out += char;
  }
  return out;
}

async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const result = await getPool().query(toPg(sql), params as never[]);
  return result.rows as T[];
}

/** Creates the schema. Called by `npm run db:push`, never on import: on a
 *  serverless host every cold start would otherwise race every other one. */
export async function pushSchema() {
  await getPool().query(SCHEMA);
}

export async function closePool() {
  await getPool().end();
}

export type Role = "admin" | "client";

export type User = {
  id: number;
  email: string;
  name: string;
  company: string;
  password_hash: string;
  role: Role;
  session_version: number;
  must_reset: number;
  seen_intro: number;
  status: "active" | "archived";
  project_name: string;
  starts_on: string;
  created_at: string;
  last_seen_at: string | null;
};

export type Deliverable = {
  id: number;
  user_id: number;
  title: string;
  summary: string;
  kind: string;
  status: DeliverableStatus;
  url: string;
  due_on: string;
  position: number;
  created_at: string;
  delivered_at: string | null;
  approved_at: string | null;
};

export type DeliverableStatus = "queued" | "in_progress" | "review" | "approved";

export type FileRow = {
  id: number;
  user_id: number;
  uploaded_by: number;
  uploader_role: Role;
  label: string;
  category: string;
  file_name: string;
  stored_name: string;
  mime: string;
  size: number;
  created_at: string;
};

export type Message = {
  id: number;
  user_id: number;
  author_id: number;
  author_role: Role;
  author_name: string;
  body: string;
  created_at: string;
  read_by_client: number;
  read_by_admin: number;
};

export type Note = { id: number; user_id: number; author_name: string; body: string; created_at: string };

export type ActivityRow = {
  id: number;
  user_id: number | null;
  actor_name: string;
  actor_role: Role;
  kind: string;
  summary: string;
  created_at: string;
};

/** Small typed wrappers so callers never touch the driver directly. */
export async function get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return query<T>(sql, params);
}

export async function run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  const result = await getPool().query(toPg(sql), params as never[]);
  return { changes: result.rowCount ?? 0 };
}

/** An INSERT whose new id the caller needs. SQLite handed this back on every
 *  write as lastInsertRowid; Postgres has to be asked for it. */
export async function insert(sql: string, params: unknown[] = []): Promise<number> {
  const row = await get<{ id: number }>(sql + " RETURNING id", params);
  if (!row) throw new Error("Insert returned no id.");
  return Number(row.id);
}

export async function getSetting(key: string): Promise<string> {
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? "";
}

export async function setSetting(key: string, value: string) {
  await run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}

export async function logActivity(entry: {
  userId?: number | null;
  actorName: string;
  actorRole: Role;
  kind: string;
  summary: string;
}) {
  await run("INSERT INTO activity (user_id, actor_name, actor_role, kind, summary) VALUES (?, ?, ?, ?, ?)", [
    entry.userId ?? null,
    entry.actorName,
    entry.actorRole,
    entry.kind,
    entry.summary,
  ]);
}

export default getPool;
