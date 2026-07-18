# 19 — Migration Phase 3: Remove the Built-In CRM, Add CRM Connectors

Turns `.claude/docs/05-crm-integrations.md`,
`.claude/decisions/ADR-0001-remove-embedded-crm.md`, and
`.claude/docs/10-migration-roadmap.md` (Phase 3) into ready-to-paste
OpenCode prompts. Assumes the enrichment pipeline from
`18-phase2-enrichment-pipeline-prompts.md` is already producing `enriched`
leads. No code included.

---

## 1. Ground rules for this whole pack

**Prompt:**

"Before implementing any CRM connector, confirm these constraints from
`.claude/docs/05-crm-integrations.md` for the rest of this work: every
connector is a queued job (per `ADR-0003-queue-based-processing.md`),
retried with backoff on transient failures, and idempotent per
lead+destination — re-sending an already-exported lead must update the
existing record at the destination, never create a duplicate. Track this
idempotency via an external-ID mapping table keyed by workspace +
destination + lead. After retries are exhausted, mark the export
`failed` with a visible, human-readable reason so the workspace can fix
credentials/URL and manually re-trigger — never a silent drop. Do not
design a bespoke delivery mechanism per connector; all three connectors
below share this same delivery-guarantee model."

---

## 2. Ship the Google Sheets connector first

**Prompt:**

"Per `.claude/docs/05-crm-integrations.md`, take the existing Apps Script
Web App URL pattern (already documented and working per
`.claude/docs/02-current-state-audit.md`) and make it workspace-scoped
instead of operator-global — the Web App URL becomes a per-workspace
encrypted setting (per the Phase 1 credential-storage work), not a
single deployment-wide value. Add automatic per-lead push the moment a
lead reaches the `enriched` state from the pipeline (per Phase 2), in
addition to keeping the existing manual 'sync all' bulk action available
for workspaces that connect Sheets after already having leads. Reuse the
shared delivery-guarantee model from the previous prompt for this
connector's queued export job."

**Why it matters here:** this is explicitly the lowest-integration-risk
connector to ship first per the migration roadmap — the pattern already
exists and works; this step is only about making it workspace-scoped and
automatic rather than building something new.

---

## 3. Ship the generic outbound webhook connector

**Prompt:**

"Per `.claude/docs/05-crm-integrations.md`, add a generic outbound-webhook
connector: a workspace can configure an outbound URL, optionally with a
bearer token or shared secret, that receives the same enriched-lead
payload shape used for every other connector (score, classification,
detected opportunity gaps, website-quality signals, contact info,
source, and a link back to the original Google Maps listing where
applicable). This is the connector that covers Salesforce, Pipedrive,
Zoho, a workspace's own internal tool, or a Zapier/Make automation,
without CreativeLead needing a bespoke integration for each one. Apply
the same queued, retried, idempotent-per-lead-and-destination delivery
model as the Sheets connector."

---

## 4. Ship the HubSpot OAuth connector

**Prompt:**

"Per `.claude/docs/05-crm-integrations.md`, add an OAuth-based HubSpot
connection per workspace (HubSpot's free tier is workable for
contacts/companies at small volume, consistent with the free-to-use
product requirement — CreativeLead itself must never pay for a
destination on a workspace's behalf, per the spirit of
`ADR-0002-no-payment-system.md`). Map an enriched lead to a HubSpot
Contact or Company (most leads here are businesses, so prefer Company
where it fits HubSpot's model better) with enrichment fields mapped to
custom or standard HubSpot properties: score, classification
(Hot/Warm/Cold), detected opportunity gaps, website-quality signals,
source ('CreativeLead extraction'), and the original Google Maps listing
link. Push automatically on enrichment completion, and keep a manual
per-lead and bulk-selection re-sync action available for workspaces that
connect HubSpot after already having leads — matching the Sheets
connector's behavior. Apply the same shared delivery-guarantee model as
the other two connectors."

---

## 5. Retire the Kanban pipeline

**Prompt:**

"Per `ADR-0001-remove-embedded-crm.md` and the Phase 3 migration
roadmap, once at least one CRM connector from the prompts above is stable
in production, remove the in-app Kanban pipeline UI (`/pipeline`) and its
underlying schema/IndexedDB usage entirely. Migrate any in-flight lead
status currently tracked by the Kanban board (deal stage, won/lost) to
CreativeLead's new minimal internal status enum
(`new / enriching / enriched / exported / failed`, from the enrichment
pipeline's state machine) — this internal status tracks CreativeLead's
own processing pipeline, not deal stages, and must not be expanded back
into a deal-tracking system. Before deleting anything, confirm with me
which workspaces (if any, at this point in the migration) have Kanban
data that needs this migration path, versus which are new workspaces with
nothing to migrate. Update any navigation, docs, or onboarding copy that
still references the Pipeline/Kanban feature."

**Why it matters here:** `ADR-0001-remove-embedded-crm.md` is explicit
that deal/stage tracking, won/lost tracking, and notes/attachments/
follow-ups now belong entirely to whichever CRM the workspace connects —
removing the Kanban UI only after a connector is proven stable avoids
leaving workspaces with nowhere to track that information mid-transition.

---

### How to use this pack

Run prompts 1 through 4 in order (2, 3, and 4 can also run in parallel
against different areas of the codebase once prompt 1's ground rules are
agreed, since each connector is independent). Run prompt 5 only after at
least one connector has been live and stable for a reasonable window —
don't remove the Kanban UI in the same deploy that ships the first
connector.
