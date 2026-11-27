import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hit, tooMany } from "@/lib/rateLimit";
import { run } from "@/lib/db";

export async function POST() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const limit = await hit("write", session.userId);
  if (!limit.allowed) return tooMany(limit);
  await run("UPDATE users SET seen_intro = 1 WHERE id = ?", [session.userId]);
  return NextResponse.json({ ok: true });
}
