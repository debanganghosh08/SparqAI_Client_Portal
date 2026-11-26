// Sessions are a signed JWT in an httpOnly cookie. The signing key comes from
// AUTH_SECRET, which `npm run setup` generates into .env.local. There is no
// third-party auth provider and no API key anywhere in this file.
import { cookies } from "next/headers";
import { get } from "@/lib/db";
import type { Role } from "./db";

export { createSessionToken, verifySessionToken, COOKIE_NAME } from "./sessionToken";
import { verifySessionToken, COOKIE_NAME, type Session } from "./sessionToken";
export type { Session } from "./sessionToken";
const MAX_AGE = 60 * 60 * 12;

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const account = get<{ session_version: number; status: string }>(
    "SELECT session_version, status FROM users WHERE id = ?",
    [session.userId],
  );
  if (!account || account.status !== "active" || Number(account.session_version ?? 0) !== session.sessionVersion) return null;
  return session;
}

/** Throws-free guard for route handlers: returns the session or null. */
export async function requireRole(role: Role): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (role === "admin" && session.role !== "admin") return null;
  return session;
}

export const sessionCookie = {
  name: COOKIE_NAME,
  options: { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE, secure: process.env.NODE_ENV === "production" },
};
