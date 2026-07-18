# 10 — Migration Roadmap

Phased plan from the current single-tenant internal tool to the target SaaS.
Each phase should be shippable and leave the app in a working state — this
is not a big-bang rewrite plan.

## Phase 0 — Foundations (no user-visible change)

- Introduce the workspace concept in the schema and wire every existing
  table to a `workspace_id`, backfilled with a single default workspace so
  the current single-operator deployment keeps working unchanged.
- Stand up the worker process and job queue, initially just moving
  existing synchronous operations (website probing, AI scoring) behind it
  without changing behavior — this validates the infra shift
  (`08-infrastructure-vps.md`) before layering new features on top.
- Collapse the dual IndexedDB/Prisma lead storage down to the server-side
  store only (see `02-current-state-audit.md`); this is a prerequisite for
  everything else and is worth doing in isolation.

## Phase 1 — Real authentication & multi-tenancy

- Replace the shared access-code login with magic-link sign-in and real
  workspace membership/roles (`04-multi-tenancy-and-auth.md`).
- Move provider credentials from operator-global settings to
  workspace-scoped encrypted settings.
- Introduce fair-use quota counters (not yet enforced strictly, but
  tracked) to start gathering real usage data ahead of Phase 4.

## Phase 2 — Automatic enrichment pipeline

- Convert enrichment from a manual, per-lead action into the automatic
  staged pipeline described in `06-enrichment-pipeline.md`, triggered on
  every ingestion path that exists at this point (import stays the only
  ingestion path until Phase 3).
- Add per-workspace and per-provider rate limiting/concurrency control in
  the job system.

## Phase 3 — Remove the built-in CRM, add CRM connectors

- Ship the Google Sheets connector first (lowest integration risk — the
  pattern already exists, just needs to become workspace-scoped and
  automatic).
- Ship the generic outbound webhook connector.
- Ship the HubSpot OAuth connector.
- Retire the Kanban pipeline UI and its underlying schema/IndexedDB usage
  once at least one connector is stable, migrating any in-flight lead
  status to the new minimal internal status enum (`05-crm-integrations.md`).

## Phase 4 — Extension sync & fair-use enforcement

- Ship authenticated, workspace-aware sync in the browser extension
  (`07-browser-extension-roadmap.md`), keeping manual JSON export as a
  fallback.
- Turn on strict fair-use quota enforcement (`09-free-tier-and-fair-use.md`)
  using the usage data gathered since Phase 1, with clear, non-punitive
  in-app messaging when a workspace hits a limit.

## Phase 5 — Hardening & polish

- Load-test the full pipeline (ingestion → enrichment → CRM export) at
  representative multi-workspace volume against the VPS budget in
  `08-infrastructure-vps.md`, and tune quotas/concurrency limits based on
  real headroom rather than guesses.
- Fill observability gaps found during load testing (structured logs,
  counters, simple alerting) — see the "Observability on a budget" section
  of `08-infrastructure-vps.md`.
- Security review pass: confirm workspace data isolation holds under
  adversarial testing (not just happy-path checks), confirm credential
  encryption and masking, confirm rate limiting covers auth and ingestion
  endpoints.
- Extension store submission (Chrome Web Store / Edge Add-ons), if
  pursued, as a separate, lower-risk track that can run in parallel with
  Phase 5 rather than blocking it.

## Ongoing, not phase-bound

- Every phase's schema and behavior changes that touch tenancy, the
  free-tier model, or add/remove a paid dependency get an ADR in
  `.claude/decisions/` before implementation.
- Keep `02-current-state-audit.md`'s "what can stay as-is" list current —
  as phases complete, prune it so it always reflects what's actually true
  of the codebase, not a stale snapshot.
