# Live provider metrics setup

The admin dashboard can request read-only aggregate metrics from EmailBison and the Sparq Labs GoHighLevel sub-account. It does not persist provider records. GoHighLevel contact/opportunity rows are reduced to counts in server memory; the API returns only totals and EmailBison campaign names/metrics. Only an admin session can call `/api/live-metrics`.

## 1. Add local credentials

Open `.env.local` in the project root. Keep the existing `AUTH_SECRET` unchanged and fill in these four values:

```dotenv
EMAILBISON_BASE_URL=https://YOUR-EMAILBISON-WORKSPACE
EMAILBISON_API_TOKEN=PASTE_EMAILBISON_TOKEN_HERE
GOHIGHLEVEL_API_KEY=PASTE_SUBACCOUNT_PRIVATE_INTEGRATION_TOKEN_HERE
GOHIGHLEVEL_LOCATION_ID=PASTE_SPARQLABS_LOCATION_ID_HERE
```

Do not add a `NEXT_PUBLIC_` prefix. Do not paste actual credentials into Slack, source files, or `.env.example`. `.env.local` is ignored by Git.

## 2. Create or retrieve provider credentials

- **EmailBison:** in the relevant workspace, open its API/developer settings and create a read-only API token if the workspace offers scoped tokens. Use that workspace's API base URL. The provider documents bearer-token API authentication at [EmailBison Developers](https://emailbison.com/developers).
- **GoHighLevel:** in the Sparq Labs sub-account, create a Private Integration Token with `contacts.readonly` and `opportunities.readonly`. Copy the sub-account Location ID. The integration uses the current v3 API. HighLevel documents the required scopes and token type for [contacts](https://marketplace.gohighlevel.com/docs/ghl/contacts/search-contacts-advanced/) and [opportunities](https://marketplace.gohighlevel.com/docs/ghl/opportunities/search-opportunity/).

## 3. Run and refresh

Restart the dev server after editing `.env.local` (`npm run dev`). Sign in using the admin account, open the dashboard, and click **Load live data**. The portal reports provider errors without including token values. A page-cap message means that collection is partial; do not treat that count as the full account total.

## What the snapshot means

- EmailBison metrics are aggregated from campaign-list fields only. A metric displays **Unavailable** when this workspace does not include that field. It does not crawl replies; the root SparqAI ingestion notes document why full reply enumeration is expensive.
- GoHighLevel v3 reports contact and opportunity counts from provider totals. The app requests a one-record sample to read total metadata, then discards it; it does not import contact or opportunity rows. No names, emails, phones, or individual CRM records are returned to the browser.
- Open, won and lost opportunity totals are requested independently. Pipeline value is not imported.
- These are shared agency workspace totals. They are **not client-specific**. Client logins continue to see clearly marked illustrative dashboard data until a verified provider-workspace-to-client mapping and sync isolation are implemented.
- This is a live read, not a scheduled sync, trend history, or EmailBison/GoHighLevel write integration. Credentials currently belong to this server deployment; move them into the hosting provider's encrypted environment settings before deployment.
