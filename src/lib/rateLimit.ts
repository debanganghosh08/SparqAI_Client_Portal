// One fixed-window limiter for every write route in the portal. It lives in the
// database rather than in a module-level Map on purpose: a Map is per-process,
// so it resets on every redeploy and counts nothing at all once the app runs on
// more than one instance. The same table therefore works on a single VM today
// and behind a load balancer later.
import { createHmac } from "node:crypto";
import { get, run } from "@/lib/db";

const FALLBACK_SECRET = "local-development-only-rate-limit-key";

/** Budgets are per identity, per window. Tuned to be invisible to a person
 *  using the portal normally and to stop a script before it costs anything. */
export const LIMITS = {
  /** Writes that only touch rows: messages, forms, progress, approvals. */
  write: { limit: 60, windowMs: 60_000 },
  /** Uploads. The file picker accepts a multiple selection and sends one
   *  request per file, so this has to clear a whole folder drop; total disk is
   *  bounded by MAX_USER_BYTES, not by this. */
  upload: { limit: 40, windowMs: 60_000 },
  /** Someone changing their own password — bcrypt is ~250 ms of CPU a hash. */
  password: { limit: 6, windowMs: 15 * 60_000 },
  /** An admin creating clients or issuing one-time passwords. Also bcrypt, but
   *  on a separate budget: inviting a seventh client in a sitting is normal
   *  work and must not be refused because of the self-service limit. */
  provision: { limit: 40, windowMs: 15 * 60_000 },
  /** Calls that leave our server for a provider API we do not own. */
  provider: { limit: 10, windowMs: 60_000 },
} as const;

export type LimitName = keyof typeof LIMITS;

export type LimitResult = { allowed: boolean; retryAfterSeconds: number };

function bucketHash(name: string, identity: string): string {
  const secret = process.env.AUTH_SECRET || FALLBACK_SECRET;
  return createHmac("sha256", secret).update(`rl:${name}:${identity}`).digest("hex");
}

/** Counts one hit against `identity` and says whether it is allowed. Call it
 *  before doing the work, not after, so a parallel burst cannot slip through. */
export async function hit(name: LimitName, identity: string | number): Promise<LimitResult> {
  const { limit, windowMs } = LIMITS[name];
  const now = Date.now();
  const key = bucketHash(name, String(identity));

  // Keep the table from growing without bound; windows are minutes, not days.
  if (Math.random() < 0.02) await run("DELETE FROM rate_limits WHERE window_started_at < ?", [now - 24 * 60 * 60 * 1000]);

  // One statement, not read-then-write. Under better-sqlite3 the old two-step
  // version was safe because the driver is synchronous and serialised every
  // caller; against Postgres over a network, two parallel requests would both
  // read the same count and both write count + 1, and the budget would be
  // whatever the concurrency happened to be. The UPSERT below decides the new
  // count inside the row lock, so a burst is counted once per request.
  const row = await get<{ hits: number; window_started_at: number }>(
    `INSERT INTO rate_limits (bucket_hash, hits, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT(bucket_hash) DO UPDATE SET
       hits = CASE WHEN ? - rate_limits.window_started_at >= ? THEN 1 ELSE rate_limits.hits + 1 END,
       window_started_at = CASE WHEN ? - rate_limits.window_started_at >= ? THEN ? ELSE rate_limits.window_started_at END
     RETURNING hits, window_started_at`,
    [key, now, now, windowMs, now, windowMs, now],
  );

  const hits = Number(row?.hits ?? 1);
  const windowStartedAt = Number(row?.window_started_at ?? now);

  if (hits <= limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAt + windowMs - now) / 1000)) };
}

/** The 429 every route returns, so the shape is identical everywhere. */
export function tooMany(result: LimitResult) {
  return Response.json(
    { error: "Too many requests. Give it a moment and try again.", retryAfterSeconds: result.retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}
