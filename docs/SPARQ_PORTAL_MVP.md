# Spark Labs client portal MVP

## What is in the demo

- A responsive client campaign dashboard with sample KPIs, an eight-week leads chart, weekly email-volume bars and a three-campaign table.
- The dashboard numbers are illustrative and explicitly marked **DEMO DATA · NOT LIVE**. They are not sourced from a client account.
- A client can submit or update a one-to-five-star project rating and an optional note. It is stored in that client user's `form_responses` row using `user_id` plus the `portal_feedback` form key. Admins see it only on that client's admin detail page.
- An integrations page lists EmailBison, Slack and Microsoft Outlook and detects whether server-side configuration values exist. The display never exposes secrets.

## What is not connected yet

The integrations view is a readiness screen, not a connector. This MVP does not implement OAuth, credential storage, provider API calls, background sync, webhooks, client workspace mapping, or reconciled campaign KPIs. A configured environment variable must not be interpreted as a connected account. Do not replace demo metrics with provider claims until a sync is implemented and verified against source dashboards.

## Configuration values

Optional placeholders are listed in `.env.example` and can be placed in the ignored `.env.local` file for local readiness checks:

- EmailBison: `EMAILBISON_API_URL`, `EMAILBISON_API_KEY`
- Slack: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- Microsoft Graph / Outlook: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`

Never prefix credentials with `NEXT_PUBLIC_`. The current server only checks whether the required values are present; it does not use them to make provider requests.

## Next implementation sequence

1. Choose whether connections belong to a client workspace or to Spark Labs, then model that ownership explicitly.
2. Implement EmailBison read-only sync first: credential handling, pagination, incremental checkpoint, campaign/send/reply mapping and source timestamps.
3. Add Microsoft OAuth with minimum Graph permissions and per-client consent; do not read message bodies unless the business requirement explicitly calls for it.
4. Add Slack OAuth and limit installation to approved workspaces/channels; define which activity is appropriate to expose to clients.
5. Persist each provider's external IDs and sync cursor per client, scope every query by client/user ownership, and record sync errors and freshness.
6. Replace each demo metric only after reconciliation tests compare portal totals with the provider's own UI/API.

## Local preview

Run `npm run setup`, `npm run seed`, then `npm run dev`. Use the local demo accounts printed by the scripts. Never reuse the published demo passwords on an internet-facing deployment.
