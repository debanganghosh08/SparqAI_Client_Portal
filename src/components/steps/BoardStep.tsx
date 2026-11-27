"use client";

import DeliverablesBoard, { type BoardItem } from "../DeliverablesBoard";

export default function BoardStep({ items }: { items: BoardItem[] }) {
  return (
    <div>
      <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-6 max-w-xl">
        Work moves Queued → In progress → <strong className="text-white font-medium">Waiting on you</strong> → Approved, and only that third stage needs you.
        Approving is one click; asking for changes sends it back to us, and the detail goes in Messages.
      </p>
      <DeliverablesBoard items={items} compact />
    </div>
  );
}
