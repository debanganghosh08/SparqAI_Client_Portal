// Long-form content for `doc` steps, written as Markdown and rendered with
// `marked`. Edit freely: these are your words to your clients. {{portal}} and
// {{email}} are replaced with the values from Admin → Settings.

export type Doc = { id: string; title: string; minutes: number; body: string };

export const DOCS: Record<string, Doc> = {
  "how-it-works": {
    id: "how-it-works",
    title: "How this works",
    minutes: 2,
    body: `
## One place instead of six

Everything for this project lives in {{portal}}. No digging through email for the
brief, no wondering whether a file made it. If it is not in the portal, it did not happen.

## The five phases

**Welcome** — you are here. Read this, read the working agreement, and you are done with the paperwork.

**Onboarding** — two forms and an upload. This is the part that determines how good the work is. Nothing else in the project is as leveraged as the thirty minutes you spend here.

**Kickoff** — one call. You prepare with a five-item checklist, we come with a plan drafted from your onboarding answers.

**The build** — a live board. Every deliverable has a status: queued, in progress, in review, approved. You will never have to ask "where are we".

**Launch and handoff** — the pre-launch checklist, then the handoff pack: every file, link, and login from the engagement, yours to keep.

## How modules unlock

Modules open in order. The next one unlocks when the one before it is finished.
It is not a gate to slow you down — it is there so nobody starts the build on a
half-filled brief.

## When you need us

Use **Messages** in the sidebar. It is threaded to your project, so we answer with
your context already in front of us. Anything urgent, email us at {{email}}.
    `.trim(),
  },
  "working-agreement": {
    id: "working-agreement",
    title: "Our working agreement",
    minutes: 3,
    body: `
This is not a contract — your contract is separate. This is how we actually work,
written down so neither of us has to guess.

## What we owe you

- **A reply within one business day.** Not always an answer, but always a reply.
- **Status without asking.** The deliverables board is updated as work moves, not when you chase it.
- **A named owner.** One person is accountable for this project. You will know who.
- **Honest timelines.** If something slips, you hear it from us first, with the new date and the reason.
- **Everything, at the end.** Source files, accounts, and documentation. No hostage-taking.

## What we need from you

- **Consolidated feedback.** One round, one voice. Ten opinions arriving separately costs more than it helps.
- **A decision-maker.** Someone who can say yes without a committee.
- **Three business days for reviews.** Longer than that and the schedule moves with it.
- **Access, when asked.** Most delays we see are waiting on a login.
- **Candour.** If you hate it, say so early. We would much rather hear it now.

## Revisions

Two rounds of revision are included on each deliverable. A round means one
consolidated set of notes. A third round is not a crisis — it is a conversation
about scope, and we will have it openly.

## Scope

Anything not written in your Goals and Scope form is out of scope. That is not
us being rigid: it is how the price and the date stay honest. New ideas are
welcome; they get quoted, not absorbed.

## If it goes wrong

Tell us fast. Every bad outcome we have seen started as something small that
somebody hoped would resolve itself. It never does.
    `.trim(),
  },
  handoff: {
    id: "handoff",
    title: "Your handoff pack",
    minutes: 1,
    body: `
Everything below is yours. Download it, store it somewhere your team can find it
in a year, and do not rely on this portal being the only copy.
    `.trim(),
  },
};

export function renderDoc(body: string, vars: { portal: string; email: string }): string {
  return body.replaceAll("{{portal}}", vars.portal).replaceAll("{{email}}", vars.email);
}
