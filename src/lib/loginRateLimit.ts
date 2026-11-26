import { createHmac } from "node:crypto";
import { get, run } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_MAX_FAILURES = 5;
const IP_MAX_FAILURES = 20;
const FALLBACK_SECRET = "local-development-only-rate-limit-key";

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
    attemptsRemaining: Math.max(0, ACCOUNT_MAX_FAILURES - accountFailures),
  };
}

export function recordLoginFailure(email: string, request: Request) {
  const now = Date.now();
  let attemptsRemaining = ACCOUNT_MAX_FAILURES;
  let retryAfterSeconds = 0;

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
  }

  return { attemptsRemaining, retryAfterSeconds };
}

export function clearLoginFailures(email: string) {
  const key = bucketHash("account", email.trim().toLowerCase());
  run("DELETE FROM auth_login_attempts WHERE bucket_hash = ?", [key]);
}
