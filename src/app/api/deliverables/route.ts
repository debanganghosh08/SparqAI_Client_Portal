import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hit, tooMany } from "@/lib/rateLimit";
import { get, logActivity, run, type Deliverable } from "@/lib/db";

/** The client side of the board: approve what is in review, or send it back. */
export async function PATCH(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limit = await hit("write", session.userId);
  if (!limit.allowed) return tooMany(limit);

  const { id, action } = await req.json().catch(() => ({}));
  const row = await get<Deliverable>("SELECT * FROM deliverables WHERE id = ?", [Number(id)]);
  if (!row) return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
  if (session.role !== "admin" && row.user_id !== session.userId) {
    return NextResponse.json({ error: "Not yours." }, { status: 403 });
  }
  if (row.status !== "review") {
    return NextResponse.json({ error: "Only items in review can be actioned." }, { status: 400 });
  }

  if (action === "approve") {
    await run("UPDATE deliverables SET status = 'approved', approved_at = datetime('now') WHERE id = ?", [row.id]);
  } else if (action === "changes") {
    await run("UPDATE deliverables SET status = 'in_progress', delivered_at = NULL WHERE id = ?", [row.id]);
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  await logActivity({
    userId: row.user_id,
    actorName: session.name || session.email,
    actorRole: session.role,
    kind: action === "approve" ? "deliverable_approved" : "deliverable_changes",
    summary: `${action === "approve" ? "Approved" : "Requested changes on"} “${row.title}”`,
  });

  return NextResponse.json({ ok: true });
}
