#!/usr/bin/env node
// One-time setup: generate a signing secret, create the schema, and seed the
// admin account. Safe to run again — nothing is overwritten.
//
// Set DATABASE_URL in .env.local first (Supabase: Project Settings ->
// Database -> Connection string -> Transaction pooler).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { SCHEMA } from "../src/lib/schema.mjs";
import { pool, one, done } from "./_db.mjs";

const envPath = path.join(process.cwd(), ".env.local");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@sparqlabs.ai").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || `${crypto.randomBytes(24).toString("base64url")}A9@`;
const ADMIN_NAME = process.env.ADMIN_NAME || "Sparq Labs Admin";
if (ADMIN_PASSWORD.length < 12 || !/[A-Z]/.test(ADMIN_PASSWORD) || !/\d/.test(ADMIN_PASSWORD) || !/[^A-Za-z0-9]/.test(ADMIN_PASSWORD)) {
  throw new Error("ADMIN_PASSWORD must be 12+ characters and include uppercase, number and symbol.");
}

// 1. A signing secret for sessions. Never committed: .env.local is gitignored.
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
if (!/^AUTH_SECRET=/m.test(env)) {
  const secret = crypto.randomBytes(32).toString("base64url");
  env += `${env && !env.endsWith("\n") ? "\n" : ""}AUTH_SECRET=${secret}\n`;
  fs.writeFileSync(envPath, env);
  console.log("→ Generated AUTH_SECRET in .env.local");
} else {
  console.log("→ AUTH_SECRET already set, leaving it alone");
}

// 2. The schema.
await pool.query(SCHEMA);
console.log("→ Schema ready");

// 3. The admin account.
const existing = await one("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
let adminCreated = false;
if (existing) {
  console.log("→ An admin account already exists, leaving its credentials unchanged");
} else {
  await pool.query(
    "INSERT INTO users (email, name, password_hash, role, must_reset, seen_intro) VALUES ($1, $2, $3, 'admin', 0, 1)",
    [ADMIN_EMAIL, ADMIN_NAME, bcrypt.hashSync(ADMIN_PASSWORD, 12)],
  );
  console.log("→ Created the admin account");
  adminCreated = true;
}

console.log(`
  Sparq Labs Client Portal is set up.

    Sign in   http://localhost:3000/login
    Admin     ${adminCreated ? ADMIN_EMAIL : "Existing account preserved"}
    Password  ${adminCreated ? ADMIN_PASSWORD : "Unchanged"}

  Next:  npm run seed   (a demo client to look around with)
         npm run dev
`);

await done();
