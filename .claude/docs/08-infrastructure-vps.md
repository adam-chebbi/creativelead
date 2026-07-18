# 08 — Infrastructure for a Small VPS

## Design constraint

The stated operating environment is a **small VPS** (think: 1–2 vCPU,
2–4 GB RAM, modest disk, shared or low-tier network). Every choice in this
document is filtered through "does this still comfortably fit here at
realistic multi-tenant, multi-workspace load," not "what would we choose
with unlimited infrastructure budget."

## Process layout

- **Web process** (Next.js): stateless, handles HTTP only, never performs
  slow I/O (AI calls, scraping, bulk sends) inline — this keeps its memory
  and CPU footprint small and predictable regardless of background load.
- **Worker process**: consumes the job queue described in
  `06-enrichment-pipeline.md`, doing all AI calls, website probes,
  enrichment provider calls, CRM exports, and campaign sends. Runs as a
  separate OS process from the web app so a burst of background work
  cannot starve the request-serving process, but on the same VPS at
  launch to avoid the cost/complexity of a second server.
- **Scheduler**: folded into the worker process as periodic in-process
  timers/cron rather than a third standalone service, since its job
  (triggering scheduled campaign sends, periodic CRM re-syncs) is
  lightweight and infrequent.

## Datastore choices

- **Postgres** as the single relational datastore for everything
  workspace-scoped (leads, campaigns, settings, quota counters, job
  bookkeeping if not using a separate broker). Prefer a single, well-tuned
  Postgres instance over multiple specialized datastores — every
  additional datastore is memory and operational overhead this budget
  doesn't have room for.
- **Job queue**: prefer a lightweight, Postgres-backed or minimal-footprint
  queue over introducing a separate broker service (e.g., a full Redis
  cluster) unless/until queue throughput genuinely requires it. If a
  broker is introduced, size it deliberately (a single small Redis
  instance is fine; anything more is premature for this budget) and treat
  it as an optional performance layer, not a hard dependency the app
  can't run without.
- Avoid duplicate/legacy storage: the current IndexedDB + Prisma split
  (see `02-current-state-audit.md`) doubles the operational and cognitive
  surface for no scaling benefit — collapsing to one server-side store is
  itself a resource-efficiency win, not just a correctness one.

## Rate limiting & fairness as capacity management

- Per-workspace and per-provider rate limits (detailed in
  `06-enrichment-pipeline.md`) are as much an infrastructure decision as a
  product one: they are what prevents one workspace's bulk import from
  consuming all available CPU/network on the shared VPS. Treat "fair
  scheduling across workspaces" as a load-bearing infrastructure
  requirement, not a nice-to-have.
- Website probing (fetching and analyzing a lead's website) should be
  time-boxed and concurrency-capped globally, since it's the most
  variable-cost, externally-dependent operation in the pipeline (slow or
  hanging third-party sites can otherwise tie up worker capacity
  indefinitely).

## Deployment shape

- Containerize the web process, worker process, and Postgres (and the
  queue broker, if a separate one is used) so the whole stack can be
  brought up with a single, version-controlled compose definition — this
  keeps operations simple enough for a small VPS without a dedicated infra
  team, and keeps the "no code snippets in this document" boundary
  respected while still being concrete about *what* runs, not *how it's
  written*.
- Put a lightweight reverse proxy in front of the web process for TLS
  termination and the existing security headers, chosen for low resource
  overhead over feature breadth.
- Back up the Postgres database on a simple, regular schedule to
  off-VPS storage; this is a cheap insurance policy relative to the cost
  of losing every workspace's leads and settings.

## Observability on a budget

- Structured application logs plus a small set of counters (jobs
  processed/failed per stage, queue depth, provider error rates) are
  enough at this scale — avoid standing up a full metrics/tracing stack
  that itself competes for the VPS's limited resources.
- Alerting can start as simple threshold checks (queue depth too high,
  disk usage too high, worker process not consuming jobs) rather than a
  dedicated alerting platform.

## When the VPS is not enough

Document, but do not build ahead of need, the escalation path:

1. First lever: tighten fair-use quotas (`09-free-tier-and-fair-use.md`)
   before adding hardware — often the cheapest fix.
2. Second lever: move the worker process to its own small VPS, keeping the
   web process and database together (or split further if the database
   becomes the bottleneck).
3. Third lever: vertically scale the VPS(s) hosting the bottleneck
   component (more vCPU/RAM), since this is operationally the simplest
   scaling action available before considering any horizontal/clustered
   architecture.
4. Only after the above are exhausted does it become worth revisiting the
   "single VPS, single Postgres" assumption at all — and that
   re-evaluation deserves its own ADR when the time comes, informed by
   real usage data rather than speculative planning now.
