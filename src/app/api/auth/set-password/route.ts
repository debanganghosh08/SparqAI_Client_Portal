import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { run, logActivity } from "@/lib/db";
import { getSession, createSessionToken, sessionCookie } from "@/lib/auth";
import { isStrongEnough } from "@/lib/password";
import { hit, tooMany } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  // This route is the one place a password can be set without proving the old
  // one, so it exists only to finish an admin-issued reset. Without this check
  // anyone holding a live session — a borrowed laptop, a copied cookie — could
  // take the account over and lock its owner out. Changing a password you
  // already know goes through /api/account, which asks for the current one.
  if (!session.mustReset) {
    return NextResponse.json({ error: "Change your password from Account, where the current one is required." }, { status: 403 });
  }
  const limit = await hit("password", session.userId);
  if (!limit.allowed) return tooMany(limit);

  const { password } = await req.json().catch(() => ({}));
  if (!isStrongEnough(password)) {
    return NextResponse.json({ error: "Use 12–128 characters with an uppercase letter, a number, and a symbol." }, { status: 400 });
  }

  await run("UPDATE users SET password_hash = ?, must_reset = 0, session_version = session_version + 1 WHERE id = ?", [bcrypt.hashSync(String(password), 12), session.userId]);
  await logActivity({
    userId: session.role === "client" ? session.userId : null,
    actorName: session.name || session.email,
    actorRole: session.role,
    kind: "password",
    summary: "Set their password",
  });

  const token = await createSessionToken({ ...session, mustReset: false, sessionVersion: session.sessionVersion + 1 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
}
