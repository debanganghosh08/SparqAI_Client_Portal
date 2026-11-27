# Deploying to Vercel

The portal runs on Vercel with Supabase behind it. Both are needed: Vercel runs
the app, Supabase holds the data and the uploaded files. Vercel's filesystem is
read-only and its instances are discarded between requests, so the SQLite file
this portal used until 27 November 2026 cannot live there at all.

## 1. Supabase

Create a project (the region nearest your clients — `ap-south-1` for India) and
collect four values from it.

| Value | Where | Goes into |
| --- | --- | --- |
| Connection string, **Transaction pooler** (port 6543) | Project Settings → Database | `DATABASE_URL` |
| Project URL | Project Settings → API | `SUPABASE_URL` |
| `service_role` key | Project Settings → API | `SUPABASE_SERVICE_ROLE_KEY` |
| — | Storage → New bucket, named `portal-uploads`, **private** | `SUPABASE_STORAGE_BUCKET` |

Use the **transaction pooler**, not the direct connection. Every serverless
invocation opens its own connection; a direct connection exhausts Postgres's
limit while the site is still quiet.

The bucket must be private. The portal serves every file through
`/api/files/[id]`, which checks the session first — a public bucket would hand
out a URL that works for anyone who has it, including another client's file.

## 2. Schema and data

```bash
# .env.local needs DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm run db:push        # create the tables
npm run db:migrate     # copy the existing SQLite database and uploads across
```

`db:migrate` opens `data/portico.db` read-only and changes nothing in `data/`.
It refuses to run against a database that already has users unless you pass
`--force`.

## 3. Vercel

Import the repository, then set these in Project Settings → Environment
Variables, for Production and Preview:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | the transaction-pooler string |
| `SUPABASE_URL` | |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only; never `NEXT_PUBLIC_` |
| `SUPABASE_STORAGE_BUCKET` | `portal-uploads` |
| `AUTH_SECRET` | the same value as `.env.local`, or every existing session is invalidated |
| `LOGIN_THROTTLE` | **set to `on` before anyone outside the team has the URL** |

`TRUST_PROXY_IP` is not needed: Vercel sets `VERCEL=1` and the portal trusts
the forwarded IP automatically there.

Nothing else needs configuring. `better-sqlite3` is gone from the runtime path
and `next.config.ts` tells the bundler to leave `pg` alone.

## Before the URL leaves the team

1. `LOGIN_THROTTLE=on`. Without it, password guessing is unlimited and each
   guess costs a quarter-second of bcrypt.
2. Change both account passwords. The ones in use were chosen for a local demo
   and follow a guessable pattern.
3. Set a real support email in Admin → Settings. The login footer still offers
   the placeholder it shipped with.

## Free-tier note

A Supabase project on the free plan pauses after a week with no activity. A
demo link handed over and then left alone will stop working, and the first
request afterwards fails rather than waking it. Restore it from the Supabase
dashboard, or move the project to a paid plan if the link has to stay live.
