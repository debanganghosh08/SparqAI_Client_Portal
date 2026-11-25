const LABELS: Record<string, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "chip-todo" },
  in_progress: { label: "In progress", cls: "chip-progress" },
  review: { label: "Your review", cls: "chip-review" },
  approved: { label: "Approved", cls: "chip-done" },
};

export const DELIVERABLE_STATUSES = ["queued", "in_progress", "review", "approved"] as const;

export function statusLabel(status: string): string {
  return LABELS[status]?.label ?? status;
}

export default function StatusChip({ status }: { status: string }) {
  const meta = LABELS[status] ?? { label: status, cls: "chip-todo" };
  return <span className={`chip ${meta.cls} shrink-0`}>{meta.label}</span>;
}
