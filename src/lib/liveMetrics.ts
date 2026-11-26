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
    contacts: number;
    contactsTruncated: boolean;
    opportunities: number;
    opportunitiesTruncated: boolean;
    open: number;
    won: number;
    lost: number;
    openPipelineValue: number | null;
    currency: string | null;
  }>;
};

const PAGE_CAP = 20;
const PAGE_SIZE = 100;
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

function numberValue(...values: unknown[]): number {
  for (const candidate of values) {
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
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
    Version: "2021-07-28",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  try {
    const fetchCollection = async (kind: "contacts" | "opportunities") => {
      const rows: Record<string, unknown>[] = [];
      let total: number | null = null;
      let cursorId = "";
      let cursorTime = "";
      let hitPageCap = false;
      for (let page = 1; page <= PAGE_CAP; page += 1) {
        const url = new URL(`https://services.leadconnectorhq.com/${kind === "contacts" ? "contacts/" : "opportunities/search"}`);
        url.searchParams.set("limit", String(PAGE_SIZE));
        if (kind === "contacts") {
          url.searchParams.set("locationId", locationId);
          if (cursorId) url.searchParams.set("startAfterId", cursorId);
          if (cursorTime) url.searchParams.set("startAfter", cursorTime);
        } else {
          url.searchParams.set("page", String(page));
          url.searchParams.set("location_id", locationId);
        }
        const payload = await requestJson(url.toString(), headers);
        const batch = items(payload, kind);
        rows.push(...batch);
        const meta = (payload.meta ?? {}) as Record<string, unknown>;
        if (meta.total !== undefined && meta.total !== null && Number.isFinite(Number(meta.total))) total = Number(meta.total);
        if (!batch.length || (total !== null && rows.length >= total)) break;
        if (kind === "contacts") {
          const lastId = String(meta.startAfterId ?? "");
          const lastTime = String(meta.startAfter ?? "");
          if (!lastId || (lastId === cursorId && lastTime === cursorTime)) break;
          cursorId = lastId;
          cursorTime = lastTime;
        } else if (batch.length < PAGE_SIZE) break;
        if (page === PAGE_CAP) hitPageCap = true;
      }
      return { rows, truncated: total !== null ? rows.length < total : hitPageCap };
    };

    const [contacts, opportunities] = await Promise.all([fetchCollection("contacts"), fetchCollection("opportunities")]);
    let open = 0;
    let won = 0;
    let lost = 0;
    let openPipelineValue = 0;
    let sawCurrency = "";
    for (const opportunity of opportunities.rows) {
      const status = String(opportunity.status ?? opportunity.status_name ?? "open").toLowerCase().replace(/[- ]/g, "_");
      if (["won", "win", "closed_won", "closedwon"].includes(status)) won += 1;
      else if (["lost", "closed_lost", "closedlost"].includes(status)) lost += 1;
      else {
        open += 1;
        openPipelineValue += numberValue(opportunity.monetaryValue, opportunity.value, opportunity.expectedValue, opportunity.amount, opportunity.price);
      }
      const currency = String(opportunity.currency ?? "").trim();
      if (currency && !sawCurrency) sawCurrency = currency;
      else if (currency && currency !== sawCurrency) sawCurrency = "MIXED";
    }
    const partial = contacts.truncated || opportunities.truncated;
    return {
      state: "connected",
      message: partial ? "Counts are partial: a 2,000-record safety cap was reached." : "CRM totals loaded.",
      data: {
        contacts: contacts.rows.length,
        contactsTruncated: contacts.truncated,
        opportunities: opportunities.rows.length,
        opportunitiesTruncated: opportunities.truncated,
        open,
        won,
        lost,
        openPipelineValue: sawCurrency ? (sawCurrency === "MIXED" ? null : openPipelineValue) : null,
        currency: sawCurrency || null,
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
