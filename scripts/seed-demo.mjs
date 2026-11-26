#!/usr/bin/env node
// A demo client with a half-finished journey, a live board, files, and a
// conversation — enough to see every screen with something in it.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { SCHEMA } from "../src/lib/schema.mjs";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

const db = new Database(path.join(dataDir, "portico.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA);

const EMAIL = (process.env.DEMO_EMAIL || "dana@northwind.studio").trim().toLowerCase();
const PASSWORD = process.env.DEMO_PASSWORD || "portico-client";

let client = db.prepare("SELECT * FROM users WHERE email = ?").get(EMAIL);
if (client) {
  console.log(`→ Demo client ${EMAIL} already exists (id ${client.id}) — refreshing their data`);
  for (const t of ["progress", "form_responses", "deliverables", "files", "messages", "notes", "activity"]) {
    db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(client.id);
  }
} else {
  const info = db
    .prepare(
      `INSERT INTO users (email, name, company, password_hash, role, must_reset, seen_intro, project_name, starts_on, last_seen_at)
       VALUES (?, 'Dana Whitfield', 'Northwind Studio', ?, 'client', 0, 1, 'Brand and site refresh', date('now','-9 days'), datetime('now','-2 hours'))`
    )
    .run(EMAIL, bcrypt.hashSync(PASSWORD, 10));
  client = { id: Number(info.lastInsertRowid) };
  console.log(`→ Created demo client ${EMAIL}`);
}

const uid = client.id;
const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
const adminId = admin?.id ?? uid;
const adminName = admin?.name ?? "Portal Admin";

// Journey: welcome and onboarding done, kickoff underway.
for (const step of ["welcome-tour", "welcome-agreement", "onboarding-business", "onboarding-project", "onboarding-assets", "kickoff-prep"]) {
  db.prepare("INSERT OR IGNORE INTO progress (user_id, step_id) VALUES (?, ?)").run(uid, step);
}

const forms = {
  business: {
    legal_name: "Northwind Studio",
    website: "https://northwind.studio",
    industry: "Interior design",
    team_size: "6–20",
    what_you_do:
      "We design and fit out independent hospitality spaces — small hotels, wine bars, a few restaurants. Full service: concept, drawings, joinery, styling, and we run the install ourselves.",
    customer:
      "An owner-operator opening their second or third site. They have done one build already, it went badly, and they know what they do not want to repeat.",
    how_they_find_you: ["Referrals", "Social", "Partnerships"],
    competitors:
      "Mostly bigger studios who quote faster than we do. They lose on taste, they win on responsiveness.",
  },
  project: {
    objective:
      "A site that makes an owner-operator feel understood in the first ten seconds, and a brand system our own team can apply without asking a designer every time.",
    success_metric: "Six qualified enquiries a month, up from two",
    deadline: "Milan design week, mid April",
    budget_band: "$15k–$50k",
    in_scope: "Brand refresh, design system, six-page site, photography art direction, CMS handover.",
    out_of_scope: "Paid media, copy for the journal, anything to do with the booking system.",
    decision_makers: "Dana Whitfield (founder) — final say. Marco Salas (studio director) — reviews everything first.",
    risks:
      "April is our busiest install month. If we slip past March our team stops being available for feedback.",
  },
};
for (const [formId, data] of Object.entries(forms)) {
  db.prepare(
    `INSERT INTO form_responses (user_id, form_id, data, status, submitted_at) VALUES (?, ?, ?, 'submitted', datetime('now','-6 days'))`
  ).run(uid, formId, JSON.stringify(data));
}
db.prepare(`INSERT INTO form_responses (user_id, form_id, data, status) VALUES (?, 'kickoff-prep', ?, 'draft')`)
  .run(uid, JSON.stringify({ items: [true, true, true, true, true] }));

const deliverables = [
  ["Brand audit and territory", "Where the current mark works, where it falls apart, and three directions to choose between.", "design", "approved", "-8 days"],
  ["Design system — type and colour", "Two typefaces, a five-step neutral scale, and the one accent. Built as tokens so the site and print stay in sync.", "design", "approved", "-4 days"],
  ["Homepage concept — round one", "Two directions for the homepage. Look at the first fold and the enquiry moment; the rest is placeholder.", "design", "review", "-1 days"],
  ["Copy pass — core pages", "Home, studio, and services, written against the goals form.", "copy", "in_progress", "+3 days"],
  ["Build — six pages and CMS", "Production build with the CMS your team will actually edit.", "build", "queued", "+18 days"],
  ["Photography art direction", "Shot list and references for the April shoot.", "document", "queued", "+24 days"],
];
deliverables.forEach(([title, summary, kind, status, due], i) => {
  db.prepare(
    `INSERT INTO deliverables (user_id, title, summary, kind, status, due_on, position, created_at, delivered_at, approved_at)
     VALUES (?, ?, ?, ?, ?, date('now', ?), ?, datetime('now','-10 days'),
       CASE WHEN ? IN ('review','approved') THEN datetime('now','-2 days') ELSE NULL END,
       CASE WHEN ? = 'approved' THEN datetime('now','-2 days') ELSE NULL END)`
  ).run(uid, title, summary, kind, status, due, i + 1, status, status);
});

// A couple of files so the Files screen is not empty.
const uploadDir = path.join(dataDir, "uploads", String(uid));
fs.mkdirSync(uploadDir, { recursive: true });
const demoFiles = [
  ["northwind-brand-notes.txt", "brand", "client", "Notes on the existing brand:\n\n- The wordmark was drawn in 2016 and has been redrawn twice since, badly.\n- Nobody knows which green is correct.\n- The only asset everyone likes is the arch motif from the Lisbon site.\n"],
  ["design-system-v1.txt", "delivery", "admin", "Design system, version 1\n\nType:  Söhne for text, GT Alpina for display\nScale: 12 / 14 / 16 / 20 / 28 / 40 / 64\nInk:   #12110f on #faf8f4\nAccent: a single warm stone, used only for state\n"],
];
for (const [name, category, who, body] of demoFiles) {
  const stored = `${Date.now()}-${Math.random().toString(16).slice(2, 12)}.txt`;
  fs.writeFileSync(path.join(uploadDir, stored), body);
  db.prepare(
    `INSERT INTO files (user_id, uploaded_by, uploader_role, label, category, file_name, stored_name, mime, size, created_at)
     VALUES (?, ?, ?, '', ?, ?, ?, 'text/plain', ?, datetime('now','-3 days'))`
  ).run(uid, who === "admin" ? adminId : uid, who, category, name, stored, Buffer.byteLength(body));
}

const messages = [
  ["admin", adminName, "Welcome in, Dana. Everything for the refresh lives here — start with the Welcome module and the two onboarding forms. Anything you are unsure about, just ask in this thread.", "-9 days"],
  ["client", "Dana Whitfield", "Both forms are done. One thing I could not fit in the scope box: we have a second site opening in Porto in the autumn and I would like the system to stretch to it without a redesign.", "-6 days"],
  ["admin", adminName, "Noted, and that is exactly the kind of thing worth saying early. It changes how we build the type scale — I will bring it to kickoff rather than solving it in a message.", "-6 days"],
  ["client", "Dana Whitfield", "Perfect. Marco is on the invite too.", "-5 days"],
  ["admin", adminName, "Homepage round one is on the board now. Look at the first fold and the enquiry moment — the rest is placeholder and not worth your notes yet.", "-1 days"],
];
for (const [role, name, body, when] of messages) {
  db.prepare(
    `INSERT INTO messages (user_id, author_id, author_role, author_name, body, created_at, read_by_client, read_by_admin)
     VALUES (?, ?, ?, ?, ?, datetime('now', ?), ?, ?)`
  ).run(uid, role === "admin" ? adminId : uid, role, name, body, when, role === "client" ? 1 : 0, role === "admin" ? 1 : 0);
}

db.prepare("INSERT INTO notes (user_id, author_name, body, created_at) VALUES (?, ?, ?, datetime('now','-5 days'))").run(
  uid,
  adminName,
  "Porto opening in the autumn — Dana mentioned it in passing. Worth scoping properly before the build phase rather than absorbing it."
);

const activity = [
  ["client_created", "Invited Dana Whitfield (dana@northwind.studio)", "admin", adminName, "-9 days"],
  ["signin", "Signed in", "client", "Dana Whitfield", "-9 days"],
  ["form_submit", "Submitted “About your business”", "client", "Dana Whitfield", "-6 days"],
  ["form_submit", "Submitted “Goals and scope”", "client", "Dana Whitfield", "-6 days"],
  ["file_upload", "Uploaded northwind-brand-notes.txt", "client", "Dana Whitfield", "-3 days"],
  ["deliverable_status", "Moved “Design system — type and colour” to approved", "admin", adminName, "-4 days"],
  ["deliverable_status", "Moved “Homepage concept — round one” to review", "admin", adminName, "-1 days"],
];
for (const [kind, summary, role, name, when] of activity) {
  db.prepare("INSERT INTO activity (user_id, actor_name, actor_role, kind, summary, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))").run(
    uid, name, role, kind, summary, when
  );
}

console.log(`
  Demo data seeded.

    Client sign-in   http://localhost:3000/login
    Email            ${EMAIL}
    Password         ${PASSWORD}
`);
