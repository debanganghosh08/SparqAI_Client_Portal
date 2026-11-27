import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hit, tooMany } from "@/lib/rateLimit";
import { get, run } from "@/lib/db";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const limit = await hit("write", session.userId);
  if (!limit.allowed) return tooMany(limit);
  if (session.role !== "client") return NextResponse.json({ error: "Client feedback is for client accounts." }, { status: 403 });
  const body = await req.json().catch(() => null) as { rating?: unknown; comment?: unknown } | null;
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Rating must be a whole number from 1 to 5." }, { status: 400 });
  if (body?.comment !== undefined && typeof body.comment !== "string") return NextResponse.json({ error: "Comment must be text." }, { status: 400 });
  const comment = String(body?.comment ?? "").trim().slice(0, 1000);
  const user = await get<{ id: number; role: string; status: string }>("SELECT id, role, status FROM users WHERE id = ?", [session.userId]);
  if (!user || user.role !== "client" || user.status !== "active") return NextResponse.json({ error: "Client account is unavailable." }, { status: 403 });
  await run(`INSERT INTO form_responses (user_id, form_id, data, status, updated_at, submitted_at)
    VALUES (?, 'portal_feedback', ?, 'submitted', datetime('now'), datetime('now'))
    ON CONFLICT(user_id, form_id) DO UPDATE SET data = excluded.data, status = 'submitted', updated_at = datetime('now'), submitted_at = datetime('now')`,
  [session.userId, JSON.stringify({ rating, comment })]);
  return NextResponse.json({ ok: true });
}
