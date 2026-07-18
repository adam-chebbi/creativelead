# 16 — Migration Phase 0: Foundations (No User-Visible Change Yet)

This is the first implementation pack in the full SaaS-transformation
series. It turns `.claude/docs/01-vision-and-scope.md`,
`.claude/docs/02-current-state-audit.md`, `.claude/docs/03-target-architecture.md`,
`.claude/docs/08-infrastructure-vps.md`, `.claude/docs/10-migration-roadmap.md`
(Phase 0), and `.claude/decisions/ADR-0003-queue-based-processing.md` into
concrete, ready-to-paste prompts for OpenCode. No code is included — every
prompt describes the change to make and the constraint it must respect;
your agent writes the actual implementation. Paste these one at a time and
review the diff before moving to the next; each prompt assumes the
previous ones in this file have landed.

Read `.claude/CLAUDE.md` first if you haven't already — every prompt below
assumes its ground rules (multi-tenancy mandatory from the first schema
change, no secrets in the repo, every background job idempotent, every
external call rate-limited, boring/resource-light technology, keep the
extension's local-first spirit) are already binding for the session.

---

## 1. Introduce the workspace concept in the schema, without breaking the current deployment

**Prompt:**

"This app is currently single-tenant: leads, campaigns, and settings have
no owning workspace. Per `.claude/docs/03-target-architecture.md`, add a
`Workspace` model (id, name, created-at, and room for later
owner/billing-adjacent-but-not-billing fields) and a `WorkspaceMember`
join model with a role field (owner or member, per
`.claude/docs/04-multi-tenancy-and-auth.md`) even though real
multi-user auth doesn't exist yet — this pack only lays the schema
groundwork Phase 1 will build auth on top of. Add a `workspaceId` foreign
key, indexed, to every table that currently stores data implicitly
scoped to 'the one operator': leads, campaigns, the existing organization
settings table, and any other tenant-owned table you find during the
audit. Write a migration that creates a single default workspace and
backfills every existing row's new `workspaceId` to point at it, so the
current single-operator deployment keeps working completely unchanged
after this migration runs — no user-visible behavior change yet, this is
purely schema groundwork. Do not touch `middleware.ts` or the current
access-code auth in this prompt; that's Phase 1's job. Show me the list of
every table you added `workspaceId` to and confirm the backfill migration
is safe to run against the current production data before I approve it."

**Why it matters here:** doing tenancy first and everywhere, even before
real accounts exist, avoids the far more expensive retrofit
`.claude/CLAUDE.md` explicitly warns against — every later pack (auth,
CRM connectors, enrichment, extension sync) assumes `workspaceId` scoping
already exists on every relevant table.

---

## 2. Stand up the worker process and job queue

**Prompt:**

"Per `.claude/decisions/ADR-0003-queue-based-processing.md` and
`.claude/docs/08-infrastructure-vps.md`, introduce a second, separate
worker process (not a second web server) and a lightweight,
Postgres-backed or minimal-footprint job queue — do not add a full Redis
cluster or any managed queueing SaaS; if you believe a broker is
genuinely warranted, stop and tell me why before adding one, since the
default expectation is a queue that lives inside the same Postgres
instance already in use. In this first prompt, do not change any feature
behavior yet: move the existing website-probing and AI-scoring logic that
currently runs inline inside API route handlers behind this new queue,
so it runs in the worker process instead, but produces identical
user-visible results and timing characteristics as today (the point of
this step is validating the infrastructure shift in isolation, per the
migration roadmap, not changing what the feature does). Make sure every
job is idempotent and resumable — a job that's retried after a process
restart must not duplicate work or double-charge a rate-limited
provider's request budget. Confirm the web process no longer performs any
of this work inline as a result of this change, and that request latency
for the routes that used to do this inline work drops accordingly since
they now just enqueue and return."

**Why it matters here:** validating the worker/queue split on existing,
already-working behavior — before any new feature depends on it — means
Phase 2's automatic enrichment pipeline is built on infrastructure that's
already proven to work, rather than debugging the queue and the new
feature at the same time.

---

## 3. Collapse the dual IndexedDB/Prisma lead storage

**Prompt:**

"Per `.claude/docs/02-current-state-audit.md`, leads currently live in two
unreconciled places: the browser's IndexedDB (used by the Pipeline Kanban
board, notes, attachments, follow-ups, campaign ledger) and
Prisma/Postgres (used by import, enrichment, opportunity detection,
outreach generation). Audit every place the app reads or writes lead data
from IndexedDB, and migrate all of it to the server-side Postgres store as
the single source of truth, per `.claude/docs/03-target-architecture.md`.
Where IndexedDB currently holds data that has no Postgres equivalent yet
(Kanban notes, attachments, follow-ups), add the minimal schema needed to
represent it server-side for now — do not build out a bigger CRM-like
data model in the process; the Kanban pipeline itself is being retired in
Phase 3 per `ADR-0001-remove-embedded-crm.md`, so this step is only about
not losing data during the storage collapse, not investing further in the
feature being removed. Write a one-time client-side migration that reads
whatever's currently in a user's IndexedDB on their next page load and
pushes it to the server exactly once, then stops reading from IndexedDB
for anything other than a short-lived extension offline buffer per
`.claude/docs/07-browser-extension-roadmap.md`. Confirm no code path in
the app reads lead data from IndexedDB as its source of truth once this
prompt is done."

**Why it matters here:** the audit doc calls this split the primary
scaling blocker — it's why the current 'CRM' only works for one operator
on one browser — and every later feature (multi-tenant access, CRM
connectors, automatic enrichment across ingestion paths) assumes leads
live in exactly one place.

---

## 4. Confirm the small-VPS budget still holds after Phase 0

**Prompt:**

"Now that a worker process and job queue exist alongside the web process,
measure and report the idle CPU and RAM footprint of the whole stack (web
process, worker process, Postgres, queue if it's a separate broker) and
compare it against the small-VPS target in
`.claude/docs/08-infrastructure-vps.md` (1–2 vCPU, 2–4 GB RAM class). If
introducing the worker process pushed idle memory meaningfully higher,
tell me the specific cause (a heavier queue library, a persistent
connection pool sized too large, etc.) before we proceed to Phase 1 —
better to right-size this now, on a single default workspace's worth of
load, than after multi-tenant traffic makes the same problem harder to
isolate."

---

### How to use this pack

Run prompts 1 through 4 in order. This pack should ship as one shippable,
low-risk deploy per the migration roadmap's 'no user-visible change'
framing for Phase 0 — if any prompt's output changes visible behavior for
the current single-operator deployment, treat that as a signal something
went further than intended and ask your agent to scope it back before
merging.
