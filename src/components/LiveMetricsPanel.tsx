"use client";

import { useState } from "react";
import type { LiveMetrics } from "@/lib/liveMetrics";

function count(value: number | null | undefined) {
  return value === null || value === undefined ? "Unavailable" : new Intl.NumberFormat().format(value);
}

function statusClass(state?: string) {
  if (state === "connected") return "chip chip-done";
  if (state === "error") return "chip chip-todo";
  return "chip chip-todo";
}

export default function LiveMetricsPanel() {
  const [data, setData] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/live-metrics", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      setData(payload as LiveMetrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load live metrics.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="card p-5 lg:p-6 mb-5">
    <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
      <div>
        <p className="eyebrow mb-2">Internal account snapshot</p>
        <h2 className="text-lg font-semibold">Live provider metrics</h2>
        <p className="text-xs text-[var(--muted)] mt-1">Read-only totals from the shared Sparq Labs credentials. Visible to admins only.</p>
      </div>
      <button className="btn btn-primary btn-sm" onClick={refresh} disabled={loading}>{loading ? "Loading…" : data ? "Refresh live data" : "Load live data"}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-300 mb-4">{error}</p>}
    {!data ? <p className="text-sm text-[var(--muted)]">No API request is made until you choose Load live data.</p> : <>
      <p className="text-[11px] text-[var(--faint)] mb-4">Fetched {new Date(data.fetchedAt).toLocaleString()}</p>
      <div className="grid lg:grid-cols-2 gap-4">
        <article className="card-flat p-4">
          <div className="flex justify-between items-center gap-3"><h3 className="font-semibold">EmailBison</h3><span className={statusClass(data.emailbison.state)}>{data.emailbison.state.replaceAll("_", " ")}</span></div>
          <p className="text-xs text-[var(--muted)] mt-2">{data.emailbison.message}</p>
          {data.emailbison.data && <div className="grid grid-cols-2 gap-3 mt-4">
            <Metric label="Campaigns" value={count(data.emailbison.data.campaignCount)} />
            <Metric label="Emails sent" value={count(data.emailbison.data.emailsSent)} />
            <Metric label="Replies" value={count(data.emailbison.data.replies)} />
            <Metric label="Interested replies" value={count(data.emailbison.data.interested)} />
          </div>}
        </article>
        <article className="card-flat p-4">
          <div className="flex justify-between items-center gap-3"><h3 className="font-semibold">GoHighLevel</h3><span className={statusClass(data.gohighlevel.state)}>{data.gohighlevel.state.replaceAll("_", " ")}</span></div>
          <p className="text-xs text-[var(--muted)] mt-2">{data.gohighlevel.message}</p>
          {data.gohighlevel.data && <div className="grid grid-cols-2 gap-3 mt-4">
            <Metric label={data.gohighlevel.data.contactsTruncated ? "Contacts (partial)" : "CRM contacts"} value={count(data.gohighlevel.data.contacts)} />
            <Metric label={data.gohighlevel.data.opportunitiesTruncated ? "Opportunities (partial)" : "Opportunities"} value={count(data.gohighlevel.data.opportunities)} />
            <Metric label="Open" value={count(data.gohighlevel.data.open)} />
            <Metric label="Won / lost" value={`${count(data.gohighlevel.data.won)} / ${count(data.gohighlevel.data.lost)}`} />
            <Metric label="Open pipeline value" value={data.gohighlevel.data.openPipelineValue === null ? "Unavailable · currency not confirmed" : `${data.gohighlevel.data.currency} ${count(data.gohighlevel.data.openPipelineValue)}`} />
          </div>}
        </article>
      </div>
      {data.emailbison.data?.campaigns.length ? <div className="overflow-x-auto mt-5">
        <p className="eyebrow mb-2">EmailBison campaign totals</p>
        <table className="tbl min-w-[500px]"><thead><tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Replies</th></tr></thead><tbody>
          {data.emailbison.data.campaigns.map((campaign, index) => <tr key={`${campaign.name}-${index}`}><td className="font-medium">{campaign.name}</td><td>{campaign.status}</td><td className="num">{count(campaign.emailsSent)}</td><td className="num">{count(campaign.replies)}</td></tr>)}
        </tbody></table>
      </div> : null}
      <p className="text-[11px] leading-relaxed text-[var(--faint)] mt-4">Unavailable metrics are not returned by the provider endpoint. These shared workspace totals are not assigned to a specific client. CRM results stop after 2,000 records per collection and are marked partial when capped.</p>
    </>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="eyebrow mb-1">{label}</p><p className="font-semibold num">{value}</p></div>;
}
