import "server-only";

type ProviderState = "connected" | "not_configured" | "error";
type ProviderResult<T> = { state: ProviderState; message: string; data?: T };

export type LiveMetrics = {
  fetchedAt: string;
  emailbison: ProviderResult<{
    campaignCount: number;
    emailsSent: number | null;
    replies: number | null;
    interested: number | null;
    campaigns: { name: string; status: string; emailsSent: number | null; replies: number | null }[];
    truncated: boolean;
  }>;
  gohighlevel: ProviderResult<{
    contacts: number | null;
    contactsPartial: boolean;
    opportunities: number | null;
    opportunitiesTruncated: boolean;
    open: number | null;
    won: number | null;
    lost: number | null;
  }>;
};

const PAGE_CAP = 20;
const TIMEOUT_MS = 8_000;

async function requestJson(url: string, headers: Record<string, string>, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

function items(payload: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const data = payload[key] ?? payload.data;
  if (Array.isArray(data)) return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).data;
    if (Array.isArray(nested)) return nested.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  return [];
}

function metric(row: Record<string, unknown>, aliases: string[]): number | null {
  const containers = [row, row.stats, row.statistics, row.metrics].filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
  );
  for (const container of containers) {
    for (const key of aliases) {
      if (Object.prototype.hasOwnProperty.call(container, key)) {
        const value = Number(container[key]);
        return Number.isFinite(value) ? value : null;
      }
    }
  }
  return null;
}

function sumMetric(rows: Record<string, unknown>[], aliases: string[]): number | null {
  const values = rows.map((row) => metric(row, aliases));
  return values.length && values.every((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
}

async function emailBison(): Promise<LiveMetrics["emailbison"]> {
  const base = process.env.EMAILBISON_BASE_URL?.trim().replace(/\/+$/, "");
  const token = process.env.EMAILBISON_API_TOKEN?.trim();
  if (!base || !token) return { state: "not_configured", message: "Add the EmailBison URL and token to the server environment." };
  try {
    const parsed = new URL(base);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error("Use an HTTPS workspace URL.");
    const rows: Record<string, unknown>[] = [];
    let truncated = false;
    for (let page = 1; page <= PAGE_CAP; page += 1) {
      const url = new URL(`${parsed.origin}/api/campaigns`);
      url.searchParams.set("page", String(page));
      const payload = await requestJson(url.toString(), { Authorization: `Bearer ${token}`, Accept: "application/json" });
      const batch = items(payload, "campaigns");
      rows.push(...batch);
      const pagination = (payload.meta ?? payload.pagination) as Record<string, unknown> | undefined;
      const lastPage = Number(pagination?.last_page ?? pagination?.lastPage ?? 0);
      const hasNext = Boolean(pagination?.next_page_url ?? pagination?.nextPageUrl);
      if (!batch.length || (lastPage > 0 && page >= lastPage) || (lastPage === 0 && !hasNext && batch.length === 0)) break;
      if (page === PAGE_CAP) truncated = true;
    }
    const campaigns = rows.map((row) => ({
      name: String(row.name ?? row.title ?? `Campaign ${row.id ?? ""}`).trim(),
      status: String(row.status ?? "unknown"),
      emailsSent: metric(row, ["emails_sent", "sent", "total_sent", "sent_count", "emails_sent_count"]),
      replies: metric(row, ["replied", "replies", "reply_count", "total_replies"]),
    }));
    return {
      state: "connected",
      message: truncated ? `Showing the first ${rows.length} campaigns; page limit reached.` : "Campaign data loaded.",
      data: {
        campaignCount: rows.length,
        emailsSent: sumMetric(rows, ["emails_sent", "sent", "total_sent", "sent_count", "emails_sent_count"]),
        replies: sumMetric(rows, ["replied", "replies", "reply_count", "total_replies"]),
        interested: sumMetric(rows, ["interested", "interested_count", "positive_replies", "leads_interested"]),
        campaigns,
        truncated,
      },
    };
  } catch (error) {
    return { state: "error", message: error instanceof Error ? error.message : "EmailBison request failed." };
  }
}

async function goHighLevel(): Promise<LiveMetrics["gohighlevel"]> {
  const token = process.env.GOHIGHLEVEL_API_KEY?.trim();
  const locationId = process.env.GOHIGHLEVEL_LOCATION_ID?.trim();
  if (!token || !locationId) return { state: "not_configured", message: "Add the GoHighLevel token and location ID to the server environment." };
  const headers = {
    Authorization: `Bearer ${token}`,
    Version: "v3",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  try {
    // The v3 contact search returns a total count while returning at most one
    // record. We discard that record immediately; no contact PII is retained.
    const contactPayload = await requestJson("https://services.leadconnectorhq.com/contacts/search", headers, {
      method: "POST",
      body: JSON.stringify({ locationId, pageLimit: 1, page: 1 }),
    });
    const contactTotal = Number(contactPayload.total);
    const contacts = Number.isFinite(contactTotal) ? contactTotal : null;
    const contactsPartial = contacts === null;

    const opportunityCount = async (status: "all" | "open" | "won" | "lost") => {
      const url = new URL("https://services.leadconnectorhq.com/opportunities/search");
      url.searchParams.set("locationId", locationId);
      url.searchParams.set("limit", "1");
      url.searchParams.set("page", "1");
      url.searchParams.set("status", status);
      const payload = await requestJson(url.toString(), headers);
      const meta = (payload.meta ?? {}) as Record<string, unknown>;
      const total = Number(meta.total);
      return Number.isFinite(total) ? total : null;
    };
    const [opportunities, open, won, lost] = await Promise.all([
      opportunityCount("all"), opportunityCount("open"), opportunityCount("won"), opportunityCount("lost"),
    ]);
    const opportunitiesTruncated = opportunities === null || open === null || won === null || lost === null;
    const partial = contactsPartial || opportunitiesTruncated;
    return {
      state: "connected",
      message: partial ? "One or more exact count totals were unavailable from the CRM response." : "CRM totals loaded from provider count metadata.",
      data: {
        contacts,
        contactsPartial,
        opportunities,
        opportunitiesTruncated,
        open,
        won,
        lost,
      },
    };
  } catch (error) {
    return { state: "error", message: error instanceof Error ? error.message : "GoHighLevel request failed." };
  }
}

export async function getLiveMetrics(): Promise<LiveMetrics> {
  const [emailbisonResult, gohighlevelResult] = await Promise.all([emailBison(), goHighLevel()]);
  return { fetchedAt: new Date().toISOString(), emailbison: emailbisonResult, gohighlevel: gohighlevelResult };
}
