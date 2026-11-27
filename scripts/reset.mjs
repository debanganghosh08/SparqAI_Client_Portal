#!/usr/bin/env node
// Empties every table and every upload. There is no undo.
//
// This used to delete data/, which was the whole database. The data now lives
// in Postgres and Supabase Storage, so it is emptied rather than unlinked, and
// the schema is left in place.
import { createClient } from "@supabase/supabase-js";
import { pool, q, done } from "./_db.mjs";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "portal-uploads";
// After the LAST "@": a password may contain one, and the first would print part of it.
const host = (process.env.DATABASE_URL.split("@").pop() || "unknown").split("/")[0];

if (!process.argv.includes("--yes")) {
  console.log(`
  This empties every table on ${host} and every file in the
  ${BUCKET} bucket. Nothing is recoverable afterwards.

  Run it again with --yes if that is what you want:

    npm run reset -- --yes
`);
  process.exit(1);
}

// users last: everything else cascades from it anyway, but being explicit
// keeps the order readable.
const TABLES = ["activity", "notes", "messages", "files", "deliverables", "form_responses", "progress", "settings", "auth_login_attempts", "rate_limits", "users"];
for (const table of TABLES) {
  await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
}
console.log(`→ ${TABLES.length} tables emptied`);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("→ uploads: skipped (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)");
} else {
  const storage = createClient(url, key, { auth: { persistSession: false } });
  const { data: folders } = await storage.storage.from(BUCKET).list("", { limit: 1000 });
  let removed = 0;
  for (const folder of folders ?? []) {
    const { data: objects } = await storage.storage.from(BUCKET).list(folder.name, { limit: 1000 });
    if (!objects?.length) continue;
    await storage.storage.from(BUCKET).remove(objects.map((o) => `${folder.name}/${o.name}`));
    removed += objects.length;
  }
  console.log(`→ uploads: ${removed} objects removed`);
}

console.log("→ Done. Run `npm run setup` to start again.");
await done();
