import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, createSessionToken, sessionCookie } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { isStrongEnough } from "@/lib/password";
import { hit, tooMany } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limit = hit("write", session.userId);
  if (!limit.allowed) return tooMany(limit);

  const { name, currentPassword, newPassword } = await req.json().catch(() => ({}));
  let sessionVersion = session.sessionVersion;
  // The name ends up in the session token, so it is capped here as well as in
  // the admin route: an unbounded string would grow the cookie unbounded.
  const cleanName = typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : "";

  if (cleanName) {
    run("UPDATE users SET name = ? WHERE id = ?", [cleanName, session.userId]);
  }

  if (newPassword) {
    if (!isStrongEnough(newPassword)) return NextResponse.json({ error: "Use 12–128 characters with an uppercase letter, a number, and a symbol." }, { status: 400 });
    // bcrypt at cost 12 is a quarter-second of CPU per call, so the comparison
    // below is throttled whether or not the guess is right.
    const passwordLimit = hit("password", session.userId);
    if (!passwordLimit.allowed) return tooMany(passwordLimit);
    const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [session.userId]);
    if (!row || !bcrypt.compareSync(String(currentPassword ?? ""), row.password_hash)) {
      return NextResponse.json({ error: "Your current password is not right." }, { status: 400 });
    }
    run("UPDATE users SET password_hash = ?, must_reset = 0, session_version = session_version + 1 WHERE id = ?", [bcrypt.hashSync(String(newPassword), 12), session.userId]);
    sessionVersion += 1;
  }

  // mustReset is carried over, not cleared: posting to this route is not a way
  // to escape a pending reset, which is what clearing it unconditionally was.
  const token = await createSessionToken({
    ...session,
    name: cleanName || session.name,
    mustReset: newPassword ? false : session.mustReset,
    sessionVersion,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
}
