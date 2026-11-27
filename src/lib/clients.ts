// Read helpers shared by the client pages and the admin. Everything here runs
// on the server only, and everything is async since the move to Postgres.
import { all, get, run, type Deliverable, type FileRow, type Message, type Note, type User } from "./db";
import { ALL_STEP_IDS, journeyStats, phaseFor } from "./journey";

export async function getUser(id: number): Promise<User | undefined> {
  return get<User>("SELECT * FROM users WHERE id = ?", [id]);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return get<User>("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
}

export async function completedSteps(userId: number): Promise<string[]> {
  const rows = await all<{ step_id: string }>("SELECT step_id FROM progress WHERE user_id = ?", [userId]);
  return rows.map((r) => r.step_id).filter((id) => ALL_STEP_IDS.has(id));
}

export async function completeStep(userId: number, stepId: string) {
  // SQLite's INSERT OR IGNORE; Postgres spells it ON CONFLICT DO NOTHING.
  await run("INSERT INTO progress (user_id, step_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [userId, stepId]);
}

export async function uncompleteStep(userId: number, stepId: string) {
  await run("DELETE FROM progress WHERE user_id = ? AND step_id = ?", [userId, stepId]);
}

export async function formResponse(userId: number, formId: string) {
  const row = await get<{ data: string; status: string; submitted_at: string | null; updated_at: string }>(
    "SELECT data, status, submitted_at, updated_at FROM form_responses WHERE user_id = ? AND form_id = ?",
    [userId, formId]
  );
  if (!row) return { data: {} as Record<string, unknown>, status: "draft", submittedAt: null as string | null, updatedAt: "" };
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { data, status: row.status, submittedAt: row.submitted_at, updatedAt: row.updated_at };
}

export async function saveFormResponse(userId: number, formId: string, data: Record<string, unknown>, submit: boolean) {
  await run(
    `INSERT INTO form_responses (user_id, form_id, data, status, updated_at, submitted_at)
     VALUES (?, ?, ?, ?, datetime('now'), ?)
     ON CONFLICT(user_id, form_id) DO UPDATE SET
       data = excluded.data,
       status = excluded.status,
       updated_at = datetime('now'),
       submitted_at = COALESCE(form_responses.submitted_at, excluded.submitted_at)`,
    [userId, formId, JSON.stringify(data), submit ? "submitted" : "draft", submit ? new Date().toISOString() : null]
  );
}

export async function deliverables(userId: number): Promise<Deliverable[]> {
  return all<Deliverable>("SELECT * FROM deliverables WHERE user_id = ? ORDER BY position, id", [userId]);
}

export async function files(userId: number, category?: string): Promise<FileRow[]> {
  return category
    ? all<FileRow>("SELECT * FROM files WHERE user_id = ? AND category = ? ORDER BY created_at DESC", [userId, category])
    : all<FileRow>("SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC", [userId]);
}

export async function messages(userId: number): Promise<Message[]> {
  return all<Message>("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at", [userId]);
}

export async function unreadFor(userId: number, role: "admin" | "client"): Promise<number> {
  const col = role === "admin" ? "read_by_admin" : "read_by_client";
  const other = role === "admin" ? "client" : "admin";
  const row = await get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND author_role = ? AND ${col} = 0`,
    [userId, other]
  );
  return Number(row?.n ?? 0);
}

export async function notes(userId: number): Promise<Note[]> {
  return all<Note>("SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC", [userId]);
}

export type ClientSummary = {
  id: number;
  name: string;
  email: string;
  company: string;
  projectName: string;
  status: string;
  phase: string;
  pct: number;
  done: number;
  total: number;
  deliverables: { total: number; review: number; approved: number };
  unread: number;
  fileCount: number;
  mustReset: boolean;
  createdAt: string;
  lastSeenAt: string | null;
};

/** Five queries, whatever the number of clients.
 *
 *  This used to run three queries inside a per-client loop. Against a local
 *  SQLite file that was free; against Postgres over a network it is three
 *  round trips per client, in series, on the admin page that lists them all.
 *  The aggregates are grouped here instead and stitched together in memory. */
export async function clientSummaries(includeArchived = false): Promise<ClientSummary[]> {
  const rows = await all<User>(
    `SELECT * FROM users WHERE role = 'client' ${includeArchived ? "" : "AND status = 'active'"} ORDER BY created_at DESC`
  );
  if (rows.length === 0) return [];

  const [progressRows, deliverableRows, fileRows, unreadRows] = await Promise.all([
    all<{ user_id: number; step_id: string }>("SELECT user_id, step_id FROM progress"),
    all<{ user_id: number; status: string; n: number }>("SELECT user_id, status, COUNT(*) AS n FROM deliverables GROUP BY user_id, status"),
    all<{ user_id: number; n: number }>("SELECT user_id, COUNT(*) AS n FROM files GROUP BY user_id"),
    all<{ user_id: number; n: number }>(
      "SELECT user_id, COUNT(*) AS n FROM messages WHERE author_role = 'client' AND read_by_admin = 0 GROUP BY user_id"
    ),
  ]);

  const stepsByUser = new Map<number, Set<string>>();
  for (const row of progressRows) {
    if (!ALL_STEP_IDS.has(row.step_id)) continue;
    const set = stepsByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.step_id);
    stepsByUser.set(row.user_id, set);
  }
  const filesByUser = new Map(fileRows.map((r) => [r.user_id, Number(r.n)]));
  const unreadByUser = new Map(unreadRows.map((r) => [r.user_id, Number(r.n)]));

  return rows.map((u) => {
    const completed = stepsByUser.get(u.id) ?? new Set<string>();
    const stats = journeyStats(completed);
    const mine = deliverableRows.filter((r) => r.user_id === u.id);
    const byStatus = Object.fromEntries(mine.map((r) => [r.status, Number(r.n)]));
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      company: u.company,
      projectName: u.project_name,
      status: u.status,
      phase: phaseFor(completed),
      pct: stats.pct,
      done: stats.done,
      total: stats.total,
      deliverables: {
        total: mine.reduce((a, r) => a + Number(r.n), 0),
        review: byStatus["review"] ?? 0,
        approved: byStatus["approved"] ?? 0,
      },
      unread: unreadByUser.get(u.id) ?? 0,
      fileCount: filesByUser.get(u.id) ?? 0,
      mustReset: u.must_reset === 1,
      createdAt: u.created_at,
      lastSeenAt: u.last_seen_at,
    };
  });
}

/** Things the operator should look at, newest signal first. */
export function attention(summaries: ClientSummary[]): { clientId: number; client: string; message: string; severity: "action" | "warn" | "info" }[] {
  const items: { clientId: number; client: string; message: string; severity: "action" | "warn" | "info" }[] = [];
  for (const c of summaries) {
    if (c.unread > 0) items.push({ clientId: c.id, client: c.name, message: `${c.unread} unread message${c.unread > 1 ? "s" : ""}`, severity: "action" });
    if (c.deliverables.review > 0) items.push({ clientId: c.id, client: c.name, message: `${c.deliverables.review} deliverable${c.deliverables.review > 1 ? "s" : ""} waiting on their review`, severity: "warn" });
    if (c.mustReset) items.push({ clientId: c.id, client: c.name, message: "Invite not accepted yet — still on the one-time password", severity: "info" });
    if (!c.mustReset && c.done === 0) items.push({ clientId: c.id, client: c.name, message: "Signed in but has not started onboarding", severity: "info" });
  }
  const rank = { action: 0, warn: 1, info: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
