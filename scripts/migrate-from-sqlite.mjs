#!/usr/bin/env node
// One-time copy of the local SQLite database into Postgres, and of the local
// uploads directory into Supabase Storage. Read-only against SQLite: the file
// is opened read-only and nothing in data/ is changed or removed.
//
//   node scripts/migrate-from-sqlite.mjs            # copy, refusing to touch a non-empty target
//   node scripts/migrate-from-sqlite.mjs --force    # copy even if the target already has rows
//
// Run `npm run db:push` first.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import { pool, q, one, done } from "./_db.mjs";

const force = process.argv.includes("--force");
const dbPath = path.join(process.cwd(), "data", "portico.db");
const uploadsDir = path.join(process.cwd(), "data", "uploads");
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "portal-uploads";

if (!fs.existsSync(dbPath)) {
  console.error(`\n  No SQLite database at ${dbPath}. Nothing to migrate.\n`);
  process.exit(1);
}

const sqlite = new Database(dbPath, { readonly: true });

// Child tables first in reverse, parents first going in: users before
// anything that references a user.
const TABLES = [
  { name: "users", columns: ["id", "email", "name", "company", "password_hash", "role", "session_version", "must_reset", "seen_intro", "status", "project_name", "starts_on", "created_at", "last_seen_at"] },
  { name: "progress", columns: ["user_id", "step_id", "completed_at"] },
  { name: "form_responses", columns: ["user_id", "form_id", "data", "status", "updated_at", "submitted_at"] },
  { name: "deliverables", columns: ["id", "user_id", "title", "summary", "kind", "status", "url", "due_on", "position", "created_at", "delivered_at", "approved_at"] },
  { name: "files", columns: ["id", "user_id", "uploaded_by", "uploader_role", "label", "category", "file_name", "stored_name", "mime", "size", "created_at"] },
  { name: "messages", columns: ["id", "user_id", "author_id", "author_role", "author_name", "body", "created_at", "read_by_client", "read_by_admin"] },
  { name: "notes", columns: ["id", "user_id", "author_name", "body", "created_at"] },
  { name: "activity", columns: ["id", "user_id", "actor_name", "actor_role", "kind", "summary", "created_at"] },
  { name: "settings", columns: ["key", "value"] },
];

const existingUsers = await one("SELECT COUNT(*)::int AS n FROM users");
if (Number(existingUsers?.n ?? 0) > 0 && !force) {
  console.error(
    `\n  The target database already holds ${existingUsers.n} users.\n` +
      "  Re-run with --force only if you mean to add to it. Nothing was copied.\n",
  );
  await done();
  process.exit(1);
}

let copied = 0;
for (const table of TABLES) {
  let rows;
  try {
    rows = sqlite.prepare(`SELECT ${table.columns.join(", ")} FROM ${table.name}`).all();
  } catch (error) {
    console.log(`→ ${table.name}: skipped (${error.message})`);
    continue;
  }
  if (rows.length === 0) {
    console.log(`→ ${table.name}: empty`);
    continue;
  }
  const placeholders = table.columns.map((_, i) => `$${i + 1}`).join(", ");
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      table.columns.map((c) => row[c] ?? null),
    );
  }
  copied += rows.length;
  console.log(`→ ${table.name}: ${rows.length} rows`);
}

// Explicit ids do not advance an IDENTITY sequence, so without this the very
// next insert would collide with a row that was just copied in.
for (const table of ["users", "deliverables", "files", "messages", "notes", "activity"]) {
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`,
  );
}
console.log("→ id sequences advanced past the copied rows");

// Uploads.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("→ uploads: skipped (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)");
} else if (!fs.existsSync(uploadsDir)) {
  console.log("→ uploads: nothing on disk");
} else {
  const storage = createClient(url, key, { auth: { persistSession: false } });
  const mimeByStoredName = new Map(
    (await q("SELECT stored_name, mime FROM files")).map((r) => [r.stored_name, r.mime]),
  );
  let uploaded = 0;
  let failed = 0;
  for (const userDir of fs.readdirSync(uploadsDir)) {
    const dir = path.join(uploadsDir, userDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const name of fs.readdirSync(dir)) {
      const bytes = fs.readFileSync(path.join(dir, name));
      const { error } = await storage.storage.from(BUCKET).upload(`${userDir}/${name}`, bytes, {
        contentType: mimeByStoredName.get(name) || "application/octet-stream",
        upsert: true,
      });
      if (error) {
        failed += 1;
        console.log(`   ! ${userDir}/${name}: ${error.message}`);
      } else {
        uploaded += 1;
      }
    }
  }
  console.log(`→ uploads: ${uploaded} copied${failed ? `, ${failed} failed` : ""}`);
}

console.log(`\n  Done. ${copied} rows copied. The SQLite file was not modified.\n`);
await done();
