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
