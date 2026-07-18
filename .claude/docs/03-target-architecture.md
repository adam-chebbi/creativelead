# 03 — Target Architecture

High-level shape of the SaaS, in words. No code, no library names beyond
what's needed to reason about resource footprint — see
`08-infrastructure-vps.md` for the concrete stack choice.

## Tenancy model

- **Workspace** is the top-level tenant boundary (an agency, a freelancer,
  a small team). A workspace has members (with roles: owner, member), one
  set of connected provider credentials (AI, enrichment, CRM, email/SMS),
  one set of quota counters, and owns all leads/campaigns created inside
  it.
- Every table that stores tenant data carries a `workspace_id` and every
  server-side query is scoped by the authenticated user's active
  workspace. This is enforced at the data-access layer, not only at the
  UI layer, so a bug in one page can't leak another workspace's data.
- A user can belong to more than one workspace (e.g., an agency contractor
  working across clients), switching context explicitly.

## Request/data flow

1. **Ingestion** — a lead enters CreativeLead through one of:
   - the browser extension, authenticated to a workspace, syncing directly;
   - manual JSON/CSV import (kept as a fallback/offline path);
   - (future) a public ingestion API endpoint, for programmatic imports.
   Every path converges on the same "create lead" operation, which writes
   the raw lead and immediately enqueues an enrichment job. Nothing about
   ingestion does synchronous, slow work in the request/response cycle.

2. **Enrichment & scoring (background)** — a worker process picks up
   queued jobs, per workspace and per provider budget:
   - website reachability/SEO/performance probe (already exists, keep);
   - optional third-party contact enrichment (Hunter.io / Clearbit /
     Apollo.io, or a self-hosted heuristic fallback when no key is set);
   - AI-assisted scoring/classification and opportunity-gap detection
     using the workspace's configured (or default free-tier) AI provider;
   - result written back to the lead record, lead marked `enriched`.
   See `06-enrichment-pipeline.md` for the queue design.

3. **CRM export (background)** — once a lead is enriched (or on a schedule/
   webhook trigger, depending on the connector), a second job pushes it to
   whichever CRM connector(s) the workspace has enabled: HubSpot, Google
   Sheets, or a generic outbound webhook. See `05-crm-integrations.md`.

4. **Outreach generation (on demand, still queued)** — generating
   email/LinkedIn/WhatsApp/phone-script content stays a job, not a
   synchronous request, so a slow or rate-limited AI provider never blocks
   the UI thread or ties up a web worker process.

5. **Campaign sending (background, scheduled)** — email/SMS/WhatsApp
   sending keeps its existing provider-abstraction pattern, moved fully
   into the worker/queue system with per-workspace sending rate limits.

## Processes

- **Web process** — Next.js app serving pages and API routes. Kept
  stateless; does not perform slow I/O (scraping, AI calls, bulk sends)
  inline.
- **Worker process** — consumes the job queue for enrichment, CRM export,
  outreach generation, and campaign sending. Can run as a second process
  on the same VPS, or as a second lightweight VPS if load requires it. See
  `08-infrastructure-vps.md` for how this is sized and when to split it
  out.
- **Scheduler** — lightweight cron-style trigger for scheduled campaign
  sends and periodic CRM re-sync, run inside the worker process rather than
  as a separate service to save resources.

## Storage

- **Primary datastore**: a single relational database (Postgres),
  workspace-scoped, as the sole source of truth for leads, campaigns,
  settings, and quota counters. The current dual client/server storage
  (IndexedDB + Prisma) collapses into this single store; the extension and
  web app both talk to the server as the source of truth (see
  `07-browser-extension-roadmap.md` for how the extension keeps some
  offline resilience without owning data long-term).
- **Job queue**: a lightweight, self-hostable broker (sized in
  `08-infrastructure-vps.md`) rather than a managed queueing SaaS, to keep
  everything running on the target VPS budget without new paid
  dependencies.
- **Secrets**: workspace-scoped provider credentials (AI/CRM/enrichment/
  email/SMS keys) encrypted at rest, never exposed to the client after
  entry, never logged.

## What explicitly does not exist in this architecture

- No billing/subscription tables, no payment-provider webhooks, no plan
  tiers baked into the schema.
- No in-app CRM/pipeline schema beyond a minimal internal status enum used
  to track CreativeLead's own processing state of a lead (not a
  replacement deal-tracking system).
- No horizontal auto-scaling group, no managed Kubernetes — the design
  target is "fits on one or two small VPS instances," with an explicit,
  documented plan for what changes if that ceiling is reached (see
  `08-infrastructure-vps.md`, "When the VPS is not enough").
