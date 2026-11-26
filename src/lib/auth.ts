// Sessions are a signed JWT in an httpOnly cookie. The signing key comes from
// AUTH_SECRET, which `npm run setup` generates into .env.local. There is no
// third-party auth provider and no API key anywhere in this file.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { get } from "@/lib/db";
import type { Role } from "./db";

const DEV_SECRET = "portico-development-secret-do-not-use-in-production";

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be configured before starting in production.");
}

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || DEV_SECRET);

export const COOKIE_NAME = "portico_session";
const MAX_AGE = 60 * 60 * 12;

export type Session = {
  userId: number;
  email: string;
  name: string;
  role: Role;
  mustReset: boolean;
  sessionVersion: number;
};

export async function createSessionToken(session: Session) {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(SECRET);
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { ...payload, sessionVersion: Number(payload.sessionVersion ?? 0) } as unknown as Session;
  } catch {
    return null;
  }
}

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
