import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getLiveMetrics } from "@/lib/liveMetrics";
import { hit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const session = await requireRole("admin");
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  // Each call fans out to EmailBison and GoHighLevel. Their rate limits are
  // shared across everything Sparq runs, so a held-down button here would cost
  // us sending capacity elsewhere.
  const limit = await hit("provider", session.userId);
  if (!limit.allowed) return tooMany(limit);

  const result = await getLiveMetrics();
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
