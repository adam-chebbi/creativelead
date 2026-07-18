# CreativeLead — Project Memory (for Claude / Claude Code)

This file is the entry point for any AI session working on this repository.
Read this first, then open the relevant file(s) under `.claude/docs/` before
touching code. This file intentionally contains **no code** — it is the
product/architecture brain of the project. Implementation details belong in
the codebase itself and in PR descriptions, not here.

## 1. What CreativeLead is today

CreativeLead is currently a **single-tenant internal tool**, not a SaaS:

- Next.js 14 (App Router) app, deployed as one instance for one operator.
- Access is a single shared password (`ACCESS_CODE_HASH` cookie check in
  `middleware.ts`) — there is no concept of accounts, organizations, or
  per-user data.
- A Chrome/Edge browser extension (`browserextractor/`) scrapes business
  listings and reviews from Google Maps, entirely client-side, and exports a
  JSON file manually downloaded by the operator.
- That JSON file is manually uploaded on the `/import` page, validated,
  scored, and stored partly in the browser's IndexedDB and partly via Prisma
  API routes (`/api/leads/*`) — this dual-storage model is a legacy artifact
  and is a primary scaling blocker (see `docs/02-current-state-audit.md`).
- A built-in Kanban-style "CRM" (`/pipeline`) tracks leads through stages
  locally in the browser (IndexedDB), which does not work across devices,
  users, or organizations.
- AI features (scoring, opportunity detection, outreach message generation)
  call third-party LLM APIs directly from the settings the operator enters
  (Gemini, OpenAI, OpenRouter, Groq, Anthropic, Mistral, Cohere, or a custom
  OpenAI-compatible endpoint), favoring free-tier models.
- Optional integrations exist today: Google Sheets (via an Apps Script Web
  App URL), SMTP/SendGrid/Gmail/Resend for email campaigns, and Twilio for
  SMS/WhatsApp campaigns.
- A generic "enrichment" API key field exists for Hunter.io / Clearbit /
  Apollo.io but enrichment is optional and manual.

## 2. What we are turning it into

A **multi-tenant, production-grade SaaS** with these non-negotiable product
decisions (see the ADRs in `.claude/decisions/` for the reasoning):

1. **No built-in CRM.** The Kanban pipeline is retired. Leads live in
   CreativeLead as the source of truth for extraction + enrichment +
   scoring, and are pushed to whichever CRM the workspace connects:
   HubSpot, Google Sheets, or a generic outbound webhook/API so any
   "own CRM" can receive leads. See `docs/05-crm-integrations.md`.
2. **No payment/subscription system.** The product stays free to use.
   Sustainability comes from fair-use quotas enforced in the app, not
   billing. There is no Stripe, no invoices, no plans-with-prices. See
   `docs/09-free-tier-and-fair-use.md`.
3. **Auto-enrichment on ingestion.** Every lead — whether it arrives via
   manual import, the browser extension, or a future API — is
   automatically enriched, scored, and (if a CRM is connected) pushed
   out, with no manual "enrich" button click required. See
   `docs/06-enrichment-pipeline.md`.
4. **Runs on a small VPS.** Every architecture decision is filtered
   through "does this still work on 1–2 vCPU / 2–4 GB RAM?". Heavy or
   bursty work (enrichment, website scraping, AI calls, campaign
   sending) is queued and rate-limited, never done synchronously in a
   web request. See `docs/08-infrastructure-vps.md`.
5. **Prefer free, hosted, or self-hostable tools** over paid SaaS
   infrastructure wherever the free tier is workable at our target
   scale. Every dependency added must be justified against this in its
   ADR or PR description.

## 3. Reading order for new work

1. `.claude/docs/01-vision-and-scope.md` — what "done" looks like, what is
   explicitly out of scope.
2. `.claude/docs/02-current-state-audit.md` — inventory of the current app,
   flagged by what must change vs. what can stay.
3. `.claude/docs/03-target-architecture.md` — the system diagram in words:
   services, data flow, tenancy model.
4. The specific doc for the area you're changing (auth, CRM integrations,
   enrichment, extension, infra, fair-use limits).
5. `.claude/docs/10-migration-roadmap.md` — phase plan and current phase.
6. `.claude/decisions/` — before reversing any prior architectural choice,
   check whether an ADR already covers it and why.

## 4. Ground rules for anyone (human or AI) working on this repo

- **Multi-tenancy is mandatory from the first schema change onward.** Every
  new table needs a workspace/organization foreign key and every query must
  be scoped by it. Retrofitting tenancy later is far more expensive than
  building it in now.
- **No secrets in the repo, ever.** Provider API keys (AI, CRM, enrichment,
  email/SMS) are workspace-level encrypted settings, not `.env` values,
  once multi-tenancy lands. Until then, treat `.env` values as
  operator-only and never commit real keys.
- **Every background job must be idempotent and resumable.** Small VPS
  deployments restart; jobs must survive that without duplicating work or
  losing leads.
- **Every external call (AI, enrichment, CRM, website scraping) must be
  rate-limited and budget-capped per workspace.** This is what makes "free"
  sustainable on modest hardware.
- **Default to boring, well-supported, resource-light technology.** This is
  an operational tool for small businesses and agencies, not a place to
  showcase cutting-edge infra.
- **Keep the extension's local-first, privacy-respecting spirit**, but move
  it from "manual export/import" to "authenticated, direct, resumable sync"
  so enrichment can trigger automatically. See
  `docs/07-browser-extension-roadmap.md`.

## 5. Where to record new decisions

New architectural decisions go in `.claude/decisions/ADR-XXXX-title.md`
using the existing ADRs as a template (context, decision, consequences,
alternatives considered). Anything that changes tenancy, data ownership,
the free-tier model, or removes/adds a paid dependency needs an ADR before
implementation starts.
