#!/usr/bin/env node
// One-time setup: generate a signing secret, create the database, and seed the
// admin account. Safe to run again — nothing is overwritten.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { SCHEMA } from "../src/lib/schema.mjs";

const root = process.cwd();
const dataDir = path.join(root, "data");
const envPath = path.join(root, ".env.local");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@sparqlabs.ai").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || `${crypto.randomBytes(24).toString("base64url")}A9@`;
const ADMIN_NAME = process.env.ADMIN_NAME || "Sparq Labs Admin";
if (ADMIN_PASSWORD.length < 12 || !/[A-Z]/.test(ADMIN_PASSWORD) || !/\d/.test(ADMIN_PASSWORD) || !/[^A-Za-z0-9]/.test(ADMIN_PASSWORD)) {
  throw new Error("ADMIN_PASSWORD must be 12+ characters and include uppercase, number and symbol.");
}

fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

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

// 2. The database.
const db = new Database(path.join(dataDir, "portico.db"));
db.pragma("journal_mode = WAL");
db.exec(SCHEMA);
console.log("→ Database ready at data/portico.db");

// 3. The admin account.
const existing = db.prepare("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
let adminCreated = false;
if (existing) {
  console.log("→ An admin account already exists, leaving its credentials unchanged");
} else {
  db.prepare(
    "INSERT INTO users (email, name, password_hash, role, must_reset, seen_intro) VALUES (?, ?, ?, 'admin', 0, 1)"
  ).run(ADMIN_EMAIL, ADMIN_NAME, bcrypt.hashSync(ADMIN_PASSWORD, 12));
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
