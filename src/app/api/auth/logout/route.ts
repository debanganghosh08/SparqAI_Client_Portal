import { NextResponse } from "next/server";
import { COOKIE_NAME, getSession } from "@/lib/auth";
import { run } from "@/lib/db";

export async function POST() {
  // Clearing the cookie only asks the browser to forget the token; the token
  // itself stays valid for its full twelve hours. Bumping session_version makes
  // it fail verification, so a copy taken from a shared machine is dead the
  // moment someone signs out. It ends that account's other sessions too, which
  // is the behaviour you want from a button labelled "sign out".
  const session = await getSession();
  if (session) run("UPDATE users SET session_version = session_version + 1 WHERE id = ?", [session.userId]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
