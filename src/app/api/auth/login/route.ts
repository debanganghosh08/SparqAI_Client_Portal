import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { run, logActivity } from "@/lib/db";
import { getUserByEmail } from "@/lib/clients";
import { createSessionToken, sessionCookie } from "@/lib/auth";
import { checkLoginLimit, clearLoginFailures, recordLoginFailure } from "@/lib/loginRateLimit";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("invalid-account-placeholder", 12);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)
    || typeof password !== "string" || password.length > 128) {
    return NextResponse.json({ error: "Check the email and password format." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const limit = checkLoginLimit(normalizedEmail, req);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again after the lockout period.", attemptsRemaining: 0, retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  // The attempt is counted BEFORE the hash is compared, not after. Counting
  // afterwards left a window: a script firing fifty requests at once passed the
  // check above fifty times, because none of them had recorded a failure yet,
  // and every one of them got a guess and a quarter-second of bcrypt. Reserving
  // the attempt first means the limit holds under a parallel burst, and a
  // correct password clears the count a few lines down.
  const failure = recordLoginFailure(normalizedEmail, req);
  if (failure.exceeded) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again after the lockout period.", attemptsRemaining: 0, retryAfterSeconds: failure.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(failure.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  const user = getUserByEmail(normalizedEmail);
  const passwordMatches = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches || user.status !== "active") {
    const locked = failure.retryAfterSeconds > 0;
    return NextResponse.json(
      {
        error: locked ? "Too many sign-in attempts. Try again after the lockout period." : "That email and password do not match.",
        attemptsRemaining: failure.attemptsRemaining,
        retryAfterSeconds: failure.retryAfterSeconds,
      },
      {
        status: locked ? 429 : 401,
        headers: { "Cache-Control": "no-store", ...(locked ? { "Retry-After": String(failure.retryAfterSeconds) } : {}) },
      },
    );
  }

  clearLoginFailures(normalizedEmail, req);
  run("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?", [user.id]);
  logActivity({ userId: user.role === "client" ? user.id : null, actorName: user.name || user.email, actorRole: user.role, kind: "signin", summary: "Signed in" });

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustReset: user.must_reset === 1,
    sessionVersion: user.session_version ?? 0,
  });
  const res = NextResponse.json({ ok: true, mustReset: user.must_reset === 1, role: user.role });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
}
