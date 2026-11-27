"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusChip from "./StatusChip";
import { safeHref } from "@/lib/url";
import { fmtDate } from "@/lib/format";

export type BoardItem = { id: number; title: string; summary: string; status: string; url: string; dueOn: string };

const ORDER = ["review", "in_progress", "queued", "approved"] as const;
const GROUP_TITLE: Record<string, string> = {
  review: "Waiting on you",
  in_progress: "In progress",
  queued: "Queued",
  approved: "Approved",
};

export default function DeliverablesBoard({ items, compact = false }: { items: BoardItem[]; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");

  async function act(id: number, action: "approve" | "changes") {
    setBusy(id);
    setError("");
    const res = await fetch("/api/deliverables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusy(0);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not update that.");
      return;
    }
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-medium">Nothing on the board yet.</p>
        <p className="help mt-1.5 max-w-sm mx-auto">Every deliverable will appear here with a live status, so you never have to ask where something is.</p>
      </div>
    );
  }

  const counts = ORDER.map((status) => ({ status, n: items.filter((i) => i.status === status).length }));

  return (
    <div>
      {!compact && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
          {counts.map(({ status, n }) => (
            <div key={status} className="card-flat px-4 py-3.5">
              <p className="eyebrow mb-1.5">{GROUP_TITLE[status]}</p>
              <p className="text-[1.5rem] font-bold num leading-none">{n}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)] mb-4">{error}</p>}

      <div className="space-y-8">
        {ORDER.map((status) => {
          const group = items.filter((i) => i.status === status);
          if (group.length === 0) return null;
          return (
            <section key={status}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="eyebrow">{GROUP_TITLE[status]}</h3>
                <span className="mono num">{group.length}</span>
              </div>
              <div className="space-y-2.5">
                {group.map((d) => (
                  <div
                    key={d.id}
                    className="card p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-start gap-4"
                    style={status === "review" ? { borderColor: "rgba(195,182,216,0.3)" } : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <h4 className="text-[15px] font-semibold">{d.title}</h4>
                        <StatusChip status={d.status} />
                      </div>
                      {d.summary && <p className="text-[13px] text-[var(--muted)] leading-relaxed">{d.summary}</p>}
                      <div className="flex items-center gap-4 mt-2.5">
                        {d.dueOn && <span className="mono">Due {fmtDate(d.dueOn)}</span>}
                        {safeHref(d.url) && (
                          <a href={safeHref(d.url)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:underline underline-offset-2" style={{ color: "var(--accent)" }}>
                            Open deliverable ↗
                          </a>
                        )}
                      </div>
                    </div>
                    {d.status === "review" && (
                      <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                        <button onClick={() => act(d.id, "approve")} disabled={busy === d.id} className="btn btn-primary btn-sm flex-1 sm:flex-none">
                          Approve
                        </button>
                        <button onClick={() => act(d.id, "changes")} disabled={busy === d.id} className="btn btn-ghost btn-sm flex-1 sm:flex-none">
                          Request changes
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
