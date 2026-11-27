import { createHmac } from "node:crypto";
import { get, run } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_MAX_FAILURES = 5;
const IP_MAX_FAILURES = 20;
const FALLBACK_SECRET = "local-development-only-rate-limit-key";

/** STUBBED FOR THE TESTING PHASE (27 Nov 2026, at Debangan's request).
 *
 *  Login throttling is off: wrong passwords are not counted, nothing is
 *  written to `auth_login_attempts`, no account ever locks, and the
 *  "N sign-in attempts remaining" line never appears. Repeated sign-ins
 *  while testing were hitting the five-attempt lockout.
 *
 *  Every function below is intact. To switch throttling back on, set
 *  `LOGIN_THROTTLE=on` in the environment - nothing else to change.
 *
 *  Switch it on before this is reachable from the internet. With it off,
 *  password guessing is unlimited, and each guess costs the server a
 *  quarter-second of cost-12 bcrypt, so a single script can both brute-force
 *  an account and keep every CPU busy. */
const THROTTLE_ENABLED = process.env.LOGIN_THROTTLE === "on";

type LoginAttemptResult = { attemptsRemaining: number | null; retryAfterSeconds: number; exceeded: boolean };

/** `attemptsRemaining: null` rather than the full budget: the sign-in form
 *  only shows the countdown for an integer, so null keeps the line hidden
 *  instead of telling every tester they have five attempts left forever. */
const UNTHROTTLED: LoginAttemptResult = { attemptsRemaining: null, retryAfterSeconds: 0, exceeded: false };

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn("[auth] Login throttling is STUBBED (LOGIN_THROTTLE is not \"on\"). Password guessing is unlimited.");
}

type AttemptBucket = { bucket_hash: string; failures: number; window_started_at: number; blocked_until: number | null };
type BucketInput = { kind: "account" | "ip"; value: string; limit: number };

function bucketHash(kind: string, value: string): string {
  const secret = process.env.AUTH_SECRET || FALLBACK_SECRET;
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
}

function trustedClientIp(request: Request): string | null {
  const trustProxy = process.env.VERCEL === "1" || process.env.TRUST_PROXY_IP === "true";
  if (!trustProxy) return null;
  const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  if (!forwarded) return null;
  const candidate = forwarded.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
  return candidate && candidate.length <= 64 ? candidate : null;
}

function bucketsFor(email: string, request: Request): BucketInput[] {
  const buckets: BucketInput[] = [
    { kind: "account", value: email.trim().toLowerCase(), limit: ACCOUNT_MAX_FAILURES },
  ];
  const ip = trustedClientIp(request);
  if (ip) buckets.push({ kind: "ip", value: ip, limit: IP_MAX_FAILURES });
  return buckets;
}

function readBucket(key: string, now: number): AttemptBucket | null {
  const bucket = get<AttemptBucket>("SELECT * FROM auth_login_attempts WHERE bucket_hash = ?", [key]);
  if (!bucket) return null;
  if (now - bucket.window_started_at >= WINDOW_MS) {
    run("DELETE FROM auth_login_attempts WHERE bucket_hash = ?", [key]);
    return null;
  }
  return bucket;
}

export function checkLoginLimit(email: string, request: Request) {
  if (!THROTTLE_ENABLED) {
    warnOnce();
    return { allowed: true, retryAfterSeconds: 0, attemptsRemaining: null as number | null };
  }
  const now = Date.now();
  run("DELETE FROM auth_login_attempts WHERE window_started_at < ?", [now - 24 * 60 * 60 * 1000]);
  let retryAfterSeconds = 0;
  let accountFailures = 0;

  for (const bucketInput of bucketsFor(email, request)) {
    const key = bucketHash(bucketInput.kind, bucketInput.value);
    const bucket = readBucket(key, now);
    if (bucketInput.kind === "account") accountFailures = bucket?.failures ?? 0;
    if (bucket?.blocked_until && bucket.blocked_until > now) {
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((bucket.blocked_until - now) / 1000));
    }
  }

  return {
    allowed: retryAfterSeconds === 0,
    retryAfterSeconds,
    attemptsRemaining: Math.max(0, ACCOUNT_MAX_FAILURES - accountFailures) as number | null,
  };
}

/** Counts one attempt and says whether it is over budget. Called before the
 *  password is compared, so the decision is made on the post-increment count:
 *  better-sqlite3 is synchronous, so a burst of parallel sign-ins is serialised
 *  here and each request sees its own place in the queue. Counting afterwards
 *  instead let every request in a burst read "under the limit" at once. */
export function recordLoginFailure(email: string, request: Request): LoginAttemptResult {
  if (!THROTTLE_ENABLED) {
    warnOnce();
    return UNTHROTTLED;
  }
  const now = Date.now();
  let attemptsRemaining = ACCOUNT_MAX_FAILURES;
  let retryAfterSeconds = 0;
  let exceeded = false;

  for (const bucketInput of bucketsFor(email, request)) {
    const key = bucketHash(bucketInput.kind, bucketInput.value);
    const existing = readBucket(key, now);
    const windowStartedAt = existing?.window_started_at ?? now;
    const failures = (existing?.failures ?? 0) + 1;
    const blockedUntil = failures >= bucketInput.limit ? windowStartedAt + WINDOW_MS : null;
    run(
      `INSERT INTO auth_login_attempts (bucket_hash, failures, window_started_at, blocked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(bucket_hash) DO UPDATE SET
         failures = excluded.failures,
         window_started_at = excluded.window_started_at,
         blocked_until = excluded.blocked_until`,
      [key, failures, windowStartedAt, blockedUntil],
    );

    if (bucketInput.kind === "account") attemptsRemaining = Math.max(0, ACCOUNT_MAX_FAILURES - failures);
    if (blockedUntil && blockedUntil > now) retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((blockedUntil - now) / 1000));
    // The attempt that reaches the limit is still answered honestly; only the
    // ones past it are turned away, so five wrong guesses means five guesses.
    if (failures > bucketInput.limit) exceeded = true;
  }

  return { attemptsRemaining, retryAfterSeconds, exceeded };
}

/** Called on a successful sign-in. Every bucket the attempt was counted
 *  against is rolled back, including the IP one: the attempt is now counted
 *  before the password is checked, so a correct password that left the IP
 *  counter incremented would let an office share its way into a lockout. */
export function clearLoginFailures(email: string, request?: Request) {
  if (!THROTTLE_ENABLED) return;
  const buckets = request
    ? bucketsFor(email, request)
    : [{ kind: "account" as const, value: email.trim().toLowerCase(), limit: ACCOUNT_MAX_FAILURES }];
  for (const bucket of buckets) {
    run("DELETE FROM auth_login_attempts WHERE bucket_hash = ?", [bucketHash(bucket.kind, bucket.value)]);
  }
}
