import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./db";
const DEV_SECRET = "portico-development-secret-do-not-use-in-production";

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be configured before starting in production.");
}

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || DEV_SECRET);

export const COOKIE_NAME = "portico_session";


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

