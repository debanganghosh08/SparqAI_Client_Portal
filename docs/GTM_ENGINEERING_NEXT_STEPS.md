# Client portal — GTM engineering next steps

**Written 27 Nov 2026.** Reviewed against the running code, not the plan.

---

## The one thing this portal has to earn

A client logs into an agency portal to answer one question: *what did you send
last week, who replied, and is it working?* Everything else — files, messages,
onboarding — is convenience. That question is the reason they keep the tab open.

Right now the portal answers it with illustrative numbers. The charts on the
client overview are seeded sample data with a caption saying so. That is honest,
and it is also the gap between a portal that gets logged into weekly and one
that gets logged into once.

The second gap is the journey itself. The five phases and their deliverables
came from the open-source template this was forked from and still describe a
design studio: *Brand audit and territory*, *Design system — type and colour*,
*Photography art direction*. A GTM client who logs in sees work they did not buy.

---

## Priority 1 — the portal shows the client their own numbers

| # | Step | Why it is not just "connect the API" |
| --- | --- | --- |
| 1.1 | A **client → campaign mapping table**, assigned by a named person in the admin, never inferred | Campaign names in EmailBison are internal shorthand. Matching them to clients by name or domain is exactly the inference that `.agents/rules` forbids (hard rule 9): an unapproved mapping must resolve to **nothing**, not to a guess |
| 1.2 | **Per-client metrics derived only from approved mappings**; an unmapped client sees an empty state, not a zero | A zero reads as "you got no replies". An empty state reads as "not connected yet". They are different promises |
| 1.3 | **Reconcile before publishing.** Totals must match the provider's own dashboard, and the page must say *as of when* and *from which source* | A number in the portal that disagrees with what Sparq says on the call costs more trust than having no number at all |
| 1.4 | Fix the **GoHighLevel 401**. That key is wrong or expired — it fails in the recorded demo | Nothing downstream of it can be built or tested while it returns 401 |
| 1.5 | **Reseed the journey and deliverables for GTM**: domains and inboxes, audience build, sequence v1, warm-up, first sends, weekly review | The current seed describes a different business |

## Priority 2 — the portal makes the delivery work faster

| # | Step | The leverage |
| --- | --- | --- |
| 2.1 | Pipe **onboarding answers into the campaign brief**. The form already asks who the customer is, who they lose to, and what success looks like | Today a human reads those answers and retypes them into the audience and copy work. That retyping is the whole gap between "we collected a brief" and "the brief built the campaign" |
| 2.2 | **Deliverable templates per engagement type**, seeded when a client is created | Every client gets the same eight deliverables. Typing them each time is both slow and inconsistent |
| 2.3 | **Copy approval as a record, not a status.** Who approved which version of the sequence, and when | This is the one thing that must be provable months later, and it is the thing a client disputes |
| 2.4 | **Invitation email.** An admin currently reads a one-time password off the screen and sends it by hand | It does not scale past a handful of clients, and hand-delivery is the weakest link in an otherwise careful auth design |

## Priority 3 — the commercial layer, which is the actual product thesis

| # | Step | Note |
| --- | --- | --- |
| 3.1 | **Cost against return, per client**: mailbox and tooling spend against replies and pipeline influenced | This is SparqAI's own argument applied to Sparq's own clients. The small version — cost per qualified reply — is worth more than the full model and can ship first |
| 3.2 | **Deliverability health per client**: bounce rate, complaint rate, domain and inbox reputation | A client whose domain is burning should see it in the portal before they feel it in their reply rate. It also pre-empts the "your emails stopped working" conversation |
| 3.3 | **Staff assignment and a read-only role** | One admin role works for one operator. At twenty clients and three people it does not |

## Priority 4 — operations, before the first real client

| # | Step |
| --- | --- |
| 4.1 | Backups **and a restore drill**. An untested backup is a belief, not a backup |
| 4.2 | Pick a hosting path — see `DEPLOYMENT_READINESS.md`. On a serverless host as it stands, data disappears silently |
| 4.3 | Activity-log pagination and a retention policy. It grows on every action and is read on one page |
| 4.4 | Uptime check on `/api/health`, which already exists and is public for exactly this |

---

## Sequencing, if only one person is on it

1. **This week:** 1.4 and 1.5. Both are small, and 1.5 is the thing a prospect
   notices in the first thirty seconds.
2. **Next:** 1.1 → 1.2 → 1.3 as one piece of work. Per-client reporting is the
   portal's reason to exist and does not work partially: a mapping without
   reconciliation publishes numbers nobody can defend.
3. **Then:** 2.4 and 4.1, because they are what make the first real client safe
   rather than impressive.
4. **Then:** 2.1, which is where the portal starts saving Sparq hours instead of
   just showing Sparq's work.

## What to resist

- **Inferring the client↔campaign mapping.** It will look right in testing on
  five campaigns and will put one client's reply counts in front of another
  client the first week two campaigns share a word.
- **Publishing live provider numbers to clients before they reconcile.** Admin
  can see raw provider output because an admin can judge it. A client cannot.
- **Building the full attribution model into the portal.** It already exists in
  the main SparqAI backend. The portal should read it, not reimplement it.
