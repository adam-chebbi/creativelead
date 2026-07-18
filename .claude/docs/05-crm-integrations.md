# 05 — CRM Integrations (Replacing the Built-In CRM)

## Decision

The in-app Kanban pipeline/CRM is removed. See `ADR-0001-remove-embedded-crm.md`
for the full reasoning. CreativeLead's job is to find, enrich, and score
leads, then hand them to whatever CRM the workspace already uses. It keeps
a minimal internal status only to track its *own* processing pipeline
(e.g., `new → enriching → enriched → exported → failed`), not deal stages,
not won/lost, not notes/attachments/follow-ups — those genuinely belong in
a CRM.

## Supported CRM destinations at launch

### 1. HubSpot

- OAuth-based connection per workspace (HubSpot has a workable free tier
  for contacts/companies at small volume, which fits the "free to use"
  goal without CreativeLead needing to pay for anything on the workspace's
  behalf).
- Leads map to HubSpot **Contacts** (or **Companies**, since most leads
  here are businesses) with enrichment fields mapped to custom or standard
  HubSpot properties: score, classification (Hot/Warm/Cold), detected
  opportunity gaps, website-quality signals, source ("CreativeLead
  extraction"), and a link back to the original Google Maps listing.
- Push happens automatically once a lead finishes enrichment; a manual
  "re-sync" action stays available per lead and per bulk selection for
  workspaces that connect HubSpot after already having leads.

### 2. Google Sheets

- Keep the existing Apps Script Web App URL pattern — it already works,
  costs nothing, requires no OAuth app review, and is the easiest "I don't
  have a real CRM yet" destination for very small operators.
- Becomes workspace-scoped instead of operator-global, and becomes an
  automatic push destination (currently it's a manual "sync all" button;
  keep that as a manual bulk-resync option, but add automatic per-lead
  push on enrichment completion, matching the HubSpot behavior).

### 3. Generic outbound webhook / "bring your own CRM"

- A workspace can configure an outbound webhook URL (optionally with a
  bearer token / shared secret) that receives the same enriched-lead
  payload shape used for HubSpot/Sheets. This is how a workspace's own
  CRM, internal tool, Zapier/Make automation, or any other system can
  receive leads without CreativeLead needing a bespoke integration for
  every possible CRM.
- This is the connector that makes "or own CRM" from the product
  requirement concrete without an open-ended integration backlog.

## Delivery guarantees

- Each export attempt is a queued job (see `06-enrichment-pipeline.md` and
  `08-infrastructure-vps.md` for the shared queue design), retried with
  backoff on transient failures (network errors, rate limits), and marked
  `failed` with a visible reason after retries are exhausted so the
  workspace can fix credentials/URL and manually re-trigger — never a
  silent drop.
- Exports are idempotent per lead + destination (re-sending an
  already-exported lead updates the existing CRM record rather than
  creating a duplicate), tracked via an external-ID mapping table keyed by
  workspace + destination + lead.

## What stays inside CreativeLead vs. what moves to the CRM

| Stays in CreativeLead | Moves to the connected CRM |
|---|---|
| Extraction, enrichment, scoring, opportunity-gap detection | Deal/stage tracking |
| Outreach message generation (email/LinkedIn/WhatsApp/phone script/proposal intro) | Won/lost tracking and reasons |
| Campaign sending and delivery status | Notes, attachments, follow-up reminders |
| Internal processing status (new/enriching/enriched/exported/failed) | Multi-user collaboration on a specific deal |

## Why not build more native connectors immediately

Every additional native (OAuth-based) connector is ongoing maintenance
surface (API changes, rate limits, field-mapping edge cases) on a small
team's budget. HubSpot covers the most common "I want a real CRM and don't
have one yet" case, Google Sheets covers the "I want something dead simple
and free" case, and the generic webhook covers everyone else, including
Salesforce/Pipedrive/Zoho users, via Zapier/Make or their own middleware.
Additional native connectors can be added later behind demand, each with
its own ADR.
