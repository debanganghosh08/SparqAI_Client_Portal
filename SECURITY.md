# Security

## Reporting a vulnerability

Please do not open a public issue. Open a private
[security advisory](https://github.com/debanganghosh08/SparqAI_Client_Portal/security/advisories/new)
on this repository instead, and give it a few days before disclosing anywhere
else. This portal is a fork of [Portico](https://github.com/ufkrdev/portico); if
the problem is in code inherited unchanged from upstream, report it there too.

## What this portal does

**Passwords.** bcrypt, cost 12. Never logged, never returned by an API except
the one-time password an admin is shown once when they create or reset a client.
Twelve to 128 characters, with an uppercase letter, a number and a symbol.

**Sessions.** HS256 JWT signed with `AUTH_SECRET`, in an `httpOnly`,
`sameSite=lax` cookie, twelve-hour expiry, `secure` in production. The cookie
proves identity only. Everything that can change while a session is open is read
from the database on every request: whether the account still exists, whether it
was archived, whether a password reset is still pending, and a `session_version`
counter. Changing a password, resetting one, or signing out increments that
counter, so every token issued earlier stops verifying immediately.

**Authorisation.** Middleware rejects unauthenticated requests to every page and
every `/api` route, and `/admin/*` additionally requires the admin role. Every
page and every route handler then re-checks for itself rather than trusting the
path, because middleware runs at the edge and cannot reach the database.
Ownership is compared against the session on every client-owned row.

**Forced reset.** A client created by an admin signs in with a one-time password
and can reach nothing but the set-password screen until they choose their own.
The gate covers the API as well as the pages, and `/api/auth/set-password` —
the one route that sets a password without asking for the current one — refuses
unless the database still has a reset pending for that account.

**Login throttling is currently stubbed.** As of 27 November 2026 it is off for
a testing phase: wrong passwords are not counted and no account locks. Password
guessing is therefore unlimited, and each guess costs a quarter-second of bcrypt.
Set `LOGIN_THROTTLE=on` before this portal is reachable from the internet. The
rest of this section describes what that flag restores.

Five failed attempts per account and twenty per IP in a
fifteen-minute window, counted in the database rather than in memory so it holds
across restarts and across more than one instance. The attempt is counted before
the hash is compared, so a burst of parallel requests cannot each get a free
guess. IP throttling is on only when a trusted proxy is declared
(`TRUST_PROXY_IP=true`, or automatically on Vercel), because otherwise
`X-Forwarded-For` is whatever the caller typed.

**Rate limiting elsewhere.** Every write route has a budget per account per
window: sixty ordinary writes a minute, twelve uploads a minute, six
password operations per fifteen minutes (bcrypt at cost 12 is a quarter-second
of CPU each), and ten live-provider pulls a minute, since those leave our server
for an API whose quota is shared with the rest of Sparq.

**CSRF.** `sameSite=lax` plus an origin check on every non-GET request:
`Sec-Fetch-Site` must be same-origin, or `Origin` must match the host. A page on
another site therefore cannot post as whoever is signed in here.

**Uploads.** A MIME allowlist that rejects anything a browser executes as a
document, a 25 MB cap per file enforced on `Content-Length` before the body is
buffered, a 500 MB allowance per client so one login cannot fill the disk,
generated storage filenames, and storage under `data/uploads/<userId>/` outside
the web root. Downloads go through a route that checks the session and the owner.

**Downloads.** The stored MIME type came from whoever uploaded the file, so it
decides nothing on its own. Only images, PDFs and plain text render in the
browser tab; everything else is sent as an attachment, with `nosniff` and a
`default-src 'none'` content-security policy. SVG is deliberately excluded from
the inline list: it is an image to a person and a script host to a browser.

**Headers.** A nonce-based content-security policy per page (no `unsafe-inline`
for scripts), `frame-ancestors 'none'` and `X-Frame-Options: DENY` against
clickjacking, `nosniff`, `Referrer-Policy: same-origin`, a `Permissions-Policy`
that turns off camera, microphone, geolocation, payment and USB, and HSTS in
production.

**Links.** A deliverable link is typed by one person and clicked by another, so
only `http` and `https` URLs are stored or rendered. The post-login `?next=`
target must be a path inside the portal.

**Deletion.** Removing a client cascades to their progress, forms, deliverables,
files, messages and notes, and their upload directory is removed from disk.

## What it does not do

No two-factor authentication. No tamper protection on the audit log. No CSRF
token beyond the cookie attribute and the origin check above. No malware
scanning or magic-byte inspection of uploads — a declared type is trusted for
the allowlist, which is why nothing outside a short safe list is ever rendered
inline. No encryption of data at rest beyond whatever the host volume provides.

## Storage

Uploaded files are objects in a **private** Supabase Storage bucket, reached
with the service-role key from the server only. Every download goes through
`/api/files/[id]`, which checks the session and the owner before it reads a
byte. The bucket is never public: a public URL works for whoever holds it, and
one client's link would be one guess away from another client's file.

## Credentials

`npm run setup` generates a strong random admin password and prints it once; it
never creates a documented default. If you set `ADMIN_PASSWORD` yourself it must
be twelve or more characters with an uppercase letter, a number and a symbol.
`AUTH_SECRET` is generated into `.env.local`, which is gitignored. Rotating
`AUTH_SECRET` invalidates every session and every rate-limit bucket at once.

## Before this is reachable from the internet

Read `docs/DEPLOYMENT_READINESS.md` first. The portal keeps everything in one
SQLite file and one uploads directory on local disk, which is fine on a host
with a persistent volume and silently lossy on a serverless platform.
