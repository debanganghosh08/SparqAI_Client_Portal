import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { completedSteps, deliverables, unreadFor } from "@/lib/clients";
import PortalShell from "@/components/PortalShell";
import DeliverablesBoard from "@/components/DeliverablesBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deliverables" };

export default async function DeliverablesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const s = await getSettings();
  const items = (await deliverables(session.userId)).map((d) => ({
    id: d.id,
    title: d.title,
    summary: d.summary,
    status: d.status,
    url: d.url,
    dueOn: d.due_on,
  }));

  return (
    <PortalShell
      name={session.name || session.email}
      role={session.role}
      portalName={s.portal_name}
      completedSteps={await completedSteps(session.userId)}
      unread={await unreadFor(session.userId, "client")}
    >
      <div className="max-w-4xl mx-auto fade-up">
        <p className="eyebrow mb-3">Deliverables</p>
        <h1 className="text-[2rem] lg:text-[2.4rem] font-bold mb-2 title-grad">The board</h1>
        <p className="text-[var(--muted)] text-sm mb-3 max-w-2xl leading-relaxed">
          Everything we are producing for you, and where each piece stands. Work moves left to right, and only one stage needs you:{" "}
          <strong className="text-white font-medium">Waiting on you</strong> is where a finished piece sits until you approve it or ask for
          changes. When it reads 0, there is nothing for you to do.
        </p>
        {/* The stages in the order work moves through them. The summary cards
            below are ordered by urgency instead, which is why this line is
            here: Dai could not tell how the board worked from the cards alone. */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--muted)] mb-9">
          <span>Queued</span>
          <span aria-hidden>→</span>
          <span>In progress</span>
          <span aria-hidden>→</span>
          <span className="text-white">Waiting on you</span>
          <span aria-hidden>→</span>
          <span>Approved</span>
        </p>
        <DeliverablesBoard items={items} />
      </div>
    </PortalShell>
  );
}
