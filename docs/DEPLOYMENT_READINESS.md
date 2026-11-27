# Supabase and Vercel deployment readiness

## Current state

This portal is **not ready for a live Vercel deployment**. It currently stores users, projects, ratings, messages, deliverables and settings in a local SQLite file via `better-sqlite3`; uploads are local files. Vercel functions do not provide durable local storage across deployments/instances. The existing GTM project database URL cannot currently be verified: its configured Supabase project ref is not listed in the connected Supabase account, and a read-only connection probe returned `tenant/user not found`.

Do not copy the GTM `.env.local` into this repository or Vercel. It contains production credentials for a different app, and the configured database target is currently failing.

## Work required before a real launch

1. Locate the active Supabase project intended for the GTM app and obtain a working transaction-pooler connection URL from its Dashboard. Verify a read-only `SELECT 1` first. The ref must match the intended project.
2. Migrate this portal's tables and data layer from synchronous SQLite helpers to asynchronous PostgreSQL operations. Use a dedicated schema or a fully namespaced set of portal tables so the GTM tables are not modified. Preserve an explicit client/organization owner on every client-owned row and scope every read and write to it.
3. Add and review database migrations, constraints, indexes and row-level security policies. This app uses its own signed-cookie login today; do not assume Supabase Auth or `auth.uid()` is automatically protecting its queries.
4. Move uploaded files from local disk to Supabase Storage (or another durable object store) with private buckets and per-client authorization.
5. Add the new portal's production environment values in Vercel Project Settings. At minimum the portal needs its own `AUTH_SECRET` and its own working database URL after the PostgreSQL migration. Never put a database password in a `NEXT_PUBLIC_` variable or commit it.
6. Import `debanganghosh08/SparqAI_Client_Portal` into Vercel with the portal repository as the project root. Configure the required environment variables for Preview and Production, deploy Preview first, test both client and admin access, then promote to Production.
7. Replace illustrative campaign values with actual synced source data only after source totals reconcile with EmailBison/other provider dashboards.

## Supabase config found in the GTM project

The GTM `.env.local` has `DATABASE_URL` and `DIRECT_URL`, but the configured project ref is `gdcijutmvvnapimfynbg`. It did not match either project returned by the connected Supabase account. The read-only database probe failed with `tenant/user not found`; no schema or data was changed. The URL, password and CA certificate were not copied into this portal.

## Vercel access

No Vercel CLI is installed and this repository has no Vercel project link. No authenticated Vercel deployment capability is available in this workspace, so no project was created and nothing was deployed. Once Vercel access and a valid database target are available, use the import/setup sequence above.

---

## The hosting decision (27 Nov 2026)

**Before go-live, whichever path is taken:** set `LOGIN_THROTTLE=on` (it is
stubbed for the testing phase, so password guessing is currently unlimited) and
change both account passwords - the ones in use follow a guessable pattern and
were chosen for a local demo.

Nothing in this portal touches Supabase. There is no Supabase client, no
connection string, no Postgres driver. `src/lib/db.ts` opens
`data/portico.db` with `better-sqlite3` and `src/lib/storage.ts` writes uploads
to `data/uploads/<userId>/`. Both live on the local disk of whatever machine is
running the process.

That matters because of *how* it fails on a serverless host. It does not crash.
Each function instance starts with an empty `data/` directory, creates the
schema, works perfectly for one request, and is then thrown away. A preview
deployment looks fine. Data disappears between page loads, and uploads 404 a
minute after they succeeded. It is the worst kind of failure for something a
client logs into.

### Two paths, and what each one costs

| | **A. One host with a persistent disk** | **B. Vercel plus Supabase** |
| --- | --- | --- |
| Works today | Yes, unchanged | No |
| Code to change | A Dockerfile and a volume mount | Every database call in the app |
| Engineering effort | Half a day | Three to five days |
| Running cost | ~$5–15/month | Vercel free/Pro + Supabase free/$25 |
| Scales to | Dozens of concurrent clients comfortably | Far beyond anything planned |
| Backups | `cp` the one file on a cron, or a volume snapshot | Managed, point-in-time |
| Risk | The one disk is the single point of failure | The migration itself |

**Path A** suits where this actually is. SQLite with WAL handles a portal with
tens of clients without noticing. Fly.io, Railway, Render and a plain VPS all
offer a persistent volume. The work is a Dockerfile, a mounted volume at
`/app/data`, `AUTH_SECRET` in the host's secret store, a domain, and a nightly
copy of `portico.db` somewhere else. **Recommended for the first clients.**

**Path B** is the right destination once the portal is something Sparq sells
rather than something Sparq demos. It is not a configuration change:

1. Every `get` / `all` / `run` call becomes asynchronous — that is most route
   handlers and most server components in the app.
2. Uploads move to a private Storage bucket, with signed URLs issued by the
   existing download route so the ownership check is not lost.
3. `auth_login_attempts` and `rate_limits` move too, or the throttles stop
   counting.
4. Migrations become real migrations. `schema.mjs` is `CREATE TABLE IF NOT
   EXISTS` run on import, which Postgres will not forgive the way SQLite does.
5. Row-level security, if used, must not be mistaken for the portal's own
   authorisation. This app has its own signed-cookie login; `auth.uid()` is
   not protecting any of these queries.

### Which Supabase project

Neither of the two projects on the connected account is a portal database:

| Project | Ref | Region | Status |
| --- | --- | --- | --- |
| shrinishkarsh's Project | `vajrqyxtzkxzibskmjzr` | ap-south-1 | Inactive (paused) |
| Nishkarsh OS | `zblmamqupdwaebfraqnz` | ap-southeast-2 | Active |

Both are personal. Client names, project briefs, uploaded files and message
threads should not share a database with someone's personal project — an export,
a stray `DROP`, or a shared service-role key then reaches client data. **Create a
dedicated project for the portal, in `ap-south-1`, when Path B is taken.**
Nothing has been created, migrated or connected; this is a decision to make, not
a step that has been skipped.
