import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getLiveMetrics } from "@/lib/liveMetrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const session = await requireRole("admin");
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const result = await getLiveMetrics();
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
