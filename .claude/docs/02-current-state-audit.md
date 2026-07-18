# 02 — Current State Audit

Inventory of the existing application, and what it means for the SaaS
transformation. This is a description of *what exists*, not instructions —
see later docs for the target design.

## Application shape

- **Framework:** Next.js 14, App Router, TypeScript, deployed as a single
  Node.js process (`next start`).
- **Data layer:** Prisma ORM. A migration named
  `add_organization_settings` already exists, suggesting a first, partial
  step toward multi-tenancy was started but not carried through the rest of
  the app (auth, leads, campaigns are still single-tenant in practice).
- **Auth:** One environment-variable password hash (`ACCESS_CODE_HASH`)
  compared against a session cookie in `middleware.ts`. No user identity,
  no roles beyond a `requireRole` helper that isn't backed by real
  accounts.
- **Pages:** Import, Pipeline (Kanban CRM), Downloads (extension
  installer), Recommendations, Outreach, Campaigns, Settings — all behind
  the single shared login.

## Data storage — the core scaling blocker

Leads are stored in **two places that are not properly reconciled**:

1. The browser's **IndexedDB** (`CreativeLeadDB`), used by the Pipeline
   Kanban board, notes, attachments, follow-ups, and campaign ledger. This
   is per-browser, per-device, not backed up, and invisible to the server.
2. **Prisma/Postgres via API routes** (`/api/leads`, `/api/leads/[id]/...`),
   used for import, enrichment, opportunity detection, and outreach
   generation.

This split is why "CRM" today only really works for a single operator on a
single browser. It must be fully collapsed onto the server-side database as
part of the SaaS transformation; IndexedDB should, at most, become a
short-lived offline cache the extension uses before syncing.

## Enrichment & scoring

- Scoring (`ai_score`, competition/opportunity/SEO/website/reputation
  sub-scores) is computed from rating, review count, website reachability,
  and basic on-page signals (HTTPS, viewport meta, SEO tags, analytics,
  chat widget, load time) fetched via a server-side website-scraper
  utility.
- "Enrichment" beyond that is optional and manual: an API key field for
  Hunter.io / Clearbit / Apollo.io with no automatic trigger.
- Opportunity detection (gaps like "no website", "low review count", "low
  rating") is threshold-based and configurable per operator in Settings.

## AI provider usage

- The app already supports 7 LLM providers plus a custom OpenAI-compatible
  endpoint, explicitly favoring **free-tier models** (Gemini free tier,
  several OpenRouter `:free` models, Groq free models, Mistral/Cohere free
  tiers). This pattern is worth **keeping and formalizing** — it is exactly
  the kind of "free, no-payment-system-needed" approach the SaaS should
  keep using, just moved server-side and per-workspace instead of
  client-supplied per session.
- Gemini free tier is rate-limited to ~30 requests/minute; the app already
  retries with backoff. This kind of per-provider rate awareness needs to
  become a first-class part of the job queue, not ad hoc retry logic
  scattered through utility functions.

## Integrations already present

- **Google Sheets**: sync via an operator-provided Google Apps Script Web
  App URL (no OAuth). Good "own infrastructure" pattern to preserve as one
  of the CRM connector options.
- **Email**: SMTP host/user/pass, or SendGrid, Gmail app-password, or
  Resend, configured per operator.
- **SMS/WhatsApp**: Twilio account SID/token and from-numbers.
- **Enrichment**: generic key field for Hunter.io/Clearbit/Apollo.io.

## Browser extension (`browserextractor/`)

- Manifest-based Chrome/Edge extension. Runs entirely in the Google Maps
  tab context, extracts business + review data client-side, and exports a
  local JSON file (up to ~100 leads/session, ~20 most-recent reviews per
  business, EN + FR locale support).
- No network calls out of the extension itself today — the operator
  downloads JSON and manually uploads it on `/import`. This is
  privacy-friendly but blocks the "auto-enrich on ingestion" goal, since
  nothing happens until a human uploads a file.

## Security posture already in place (worth keeping)

- `middleware.ts` already sets solid baseline security headers
  (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, HSTS, and removes `X-Powered-By`). This pattern
  should be preserved and extended, not replaced.
- Rate-limiting (`src/lib/rateLimit.ts`) and a `requireRole` helper already
  exist as scaffolding — they need to be wired to real multi-tenant
  identity rather than removed.

## What can stay largely as-is

- The scoring model and its configurable weights/thresholds.
- The multi-provider AI abstraction and its bias toward free models.
- The outreach message generation flows and channel templates (email,
  LinkedIn, WhatsApp, proposal intro, phone script).
- The security headers and general Next.js App Router structure.
- The Google Sheets, email, and SMS/WhatsApp integration *patterns* (they
  become workspace-scoped instead of operator-global).

## What must change

- Single shared access code → real multi-tenant authentication.
- Dual client/server lead storage → single server-side source of truth.
- Manual "upload JSON then click enrich" → automatic pipeline on
  ingestion.
- In-app Kanban CRM → removed, replaced by CRM connectors.
- Operator-global settings (one set of API keys for the whole deployment)
  → workspace-scoped, encrypted settings.
- Ad hoc rate-limit/retry logic inside utility functions → a proper
  queue/worker system with per-workspace and per-provider budgets.
