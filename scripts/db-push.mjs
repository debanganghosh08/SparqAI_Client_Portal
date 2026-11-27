#!/usr/bin/env node
// Creates the schema in the database DATABASE_URL points at. Every statement
// is CREATE ... IF NOT EXISTS, so running it again is a no-op.
//
// The app no longer creates its own schema on import: on a serverless host
// every cold start would race every other one.
import { SCHEMA } from "../src/lib/schema.mjs";
import { pool, q, done } from "./_db.mjs";

// Everything after the LAST "@", not the first: a database password may
// contain an "@" of its own, and splitting on the first one would print part
// of it to the terminal.
const where = (process.env.DATABASE_URL.split("@").pop() || "unknown").split("/")[0];
console.log(`→ Applying the schema to ${where}`);

await pool.query(SCHEMA);

const tables = await q(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' ORDER BY table_name`,
);
console.log(`→ ${tables.length} tables present: ${tables.map((t) => t.table_name).join(", ")}`);
await done();
