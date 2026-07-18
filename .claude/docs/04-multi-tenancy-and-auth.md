# 04 — Multi-Tenancy & Authentication

## Why this comes first

Everything else in the transformation (CRM connectors, enrichment quotas,
extension sync) assumes a real notion of "which workspace does this belong
to." Doing this retrofit after other features exist is far more expensive
and risky than doing it first.

## Identity model

- Replace the single shared `ACCESS_CODE_HASH` cookie check with real user
  accounts. Because there is no payment system and the product must stay
  operationally simple on a small VPS, prefer the lowest-friction options
  that are still genuinely secure:
  - **Passwordless email (magic link) sign-in** as the primary method —
    no password database to protect, no password-reset flows to build,
    minimal support burden.
  - Optionally, a small set of OAuth providers (Google is the most useful
    given the existing Google Sheets integration) as an alternative
    sign-in method, added later if there's demand — not required for
    launch.
- A signed-in user creates or is invited into one or more **workspaces**.
  The first workspace a user creates on signup makes them its owner.
- Session handling replaces the current single cookie-vs-env-var check
  with a signed session tied to a specific user, and the active workspace
  is part of the session context (switchable, not fixed at login).

## Authorization model

- Two roles are enough at launch: **owner** (full control, including
  provider credentials and inviting/removing members) and **member**
  (can view/import/enrich leads, generate outreach, cannot change
  workspace-level provider credentials or billing-adjacent settings —
  there is no billing, but this boundary still matters for shared
  credentials like CRM/email API keys).
- Every API route and server action must resolve "current user → current
  workspace → role in that workspace" before touching any workspace-scoped
  data, using a single shared authorization helper rather than ad hoc
  checks per route (the existing `requireRole` helper is the right shape
  to build on, once it's backed by real accounts).

## Data isolation

- Every workspace-scoped table gets a `workspace_id` column, indexed, and
  every query path is scoped by it — no endpoint should be able to return
  another workspace's row even if it is passed a guessable numeric ID.
  Treat this as a security requirement to be tested, not just an
  implementation detail.
- Provider credentials (AI, CRM, enrichment, email/SMS) move from
  operator-level `.env`/local settings to per-workspace encrypted storage.
  Sensible per-workspace defaults (e.g., a shared, budget-capped free-tier
  AI key) can exist as a fallback for workspaces that haven't configured
  their own, but a workspace's own credentials always take precedence and
  are isolated from other workspaces.

## Migration from the current single-tenant deployment

- Existing operators of the single-tenant deployment become the **first
  workspace's owner** during the cutover; their existing leads (once
  collapsed out of IndexedDB into the server store, see
  `02-current-state-audit.md`) are attributed to that workspace.
- The shared access-code login is retired once magic-link sign-in is live;
  keep it disabled-but-documented for a short overlap window only if
  needed for the current operator's continuity, not as a long-term
  parallel auth method.

## Security follow-through

- Keep and extend the existing security headers in `middleware.ts`
  (frame options, content-type sniffing protection, referrer policy,
  HSTS) — these are already good practice and should apply to every route
  including new auth routes.
- Extend the existing rate-limiting scaffolding to be per-user/per-workspace
  and per-endpoint (sign-in attempts, API ingestion, outreach generation)
  rather than a single global limiter.
- Encrypt provider credentials at rest; never return them to the client
  after initial entry (write-only fields, masked on read, consistent with
  the current password-style input pattern already used in Settings).
