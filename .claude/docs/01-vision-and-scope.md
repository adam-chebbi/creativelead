# 01 — Vision & Scope

## Vision

CreativeLead becomes a **free, multi-tenant SaaS for local-business lead
generation and enrichment**: an operator (agency, freelancer, or SMB sales
team) signs up, extracts or imports leads, watches CreativeLead
automatically enrich and score them, and sends the qualified ones straight
into the CRM they already use — without CreativeLead trying to *be* their
CRM, and without ever being asked to pay.

## In scope for the SaaS transformation

- Multi-tenant accounts (workspaces/organizations), each with isolated data,
  settings, and provider credentials.
- Standard authentication (not a single shared access code).
- Automatic enrichment + scoring pipeline triggered on every lead ingestion
  path (manual import, extension sync, future public API).
- Outbound CRM connectors: HubSpot, Google Sheets, and a generic
  outbound-webhook/API connector for "bring your own CRM."
  connector — see `05-crm-integrations.md`.
- Removal of the in-app Kanban pipeline / lead-stage CRM.
- Fair-use quotas that keep the service free without a payment system.
- A background job system sized for a small VPS.
- An updated browser extension that authenticates to a workspace and can
  sync extracted leads directly, in addition to (or instead of) manual
  JSON export.
- Outreach message generation (email/LinkedIn/WhatsApp/phone script) and
  campaign sending remain, but move behind the same job queue and quotas.

## Explicitly out of scope

- **Any payment, billing, invoicing, plan-tiering, or metered-cost UI.**
  Fair-use limits are enforced silently/softly (see
  `09-free-tier-and-fair-use.md`), not sold as upgrades.
- **A built-in CRM/pipeline UI.** Pipeline stages, deal tracking, and
  won/lost reasons move to the connected external CRM. CreativeLead keeps a
  lightweight *status* field (e.g., "new / enriched / exported / failed")
  purely to track its own pipeline of work, not to replace a CRM.
- **Building our own contact-enrichment data source.** We orchestrate
  existing enrichment providers (or website-scrape-based, self-hosted
  enrichment where legally and technically reasonable) rather than
  building a data broker.
- **Horizontal scaling infrastructure (Kubernetes, multi-region, etc.).**
  The target is a single small-to-medium VPS (or a couple of VPS
  instances) — see `08-infrastructure-vps.md` for the ceiling this implies
  and what happens if/when it's hit.

## Definition of done (for the transformation, not any single PR)

- A new operator can create a workspace, connect one CRM destination (or
  none, using CSV/Sheet export as fallback), install the extension, extract
  leads, and see them appear — enriched and scored — without any manual
  "enrich" action and without entering payment details anywhere.
- Two different workspaces cannot see each other's leads, settings, or
  provider keys under any code path.
- The whole stack runs comfortably on the infra budget defined in
  `08-infrastructure-vps.md` under realistic multi-tenant load, degrading
  gracefully (queued, delayed, rate-limited) rather than falling over when
  under sustained load.
