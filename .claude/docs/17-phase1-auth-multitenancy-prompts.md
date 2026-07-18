# 17 — Migration Phase 1: Real Authentication & Multi-Tenancy

Turns `.claude/docs/04-multi-tenancy-and-auth.md` and
`.claude/docs/10-migration-roadmap.md` (Phase 1) into ready-to-paste
OpenCode prompts. Assumes Phase 0 (`16-phase0-foundations-prompts.md`) has
already landed, so a `Workspace`/`WorkspaceMember` schema and a working job
queue already exist. No code included — every prompt describes the
behavior and constraint; the agent writes the implementation.

---

## 1. Replace the shared access code with passwordless sign-in

**Prompt:**

"Per `.claude/docs/04-multi-tenancy-and-auth.md`, remove the single shared
`ACCESS_CODE_HASH` cookie check in `middleware.ts` and replace it with
passwordless email (magic-link) sign-in as the primary authentication
method — no password database to protect, no password-reset flow needed.
Do not build OAuth sign-in yet; the doc explicitly treats that as an
optional later addition, not required for this phase. A signed-in user
must be able to create a new workspace (becoming its owner) or accept an
invitation into an existing one. Session handling must track a specific
authenticated user and the currently active workspace as part of the
session, with an explicit workspace-switching action for users who belong
to more than one workspace — the active workspace is not fixed at login.
Keep every existing security header already set in `middleware.ts` (frame
options, content-type sniffing protection, referrer policy, HSTS, removal
of `X-Powered-By`) applied to all new auth routes, per
`.claude/docs/11-security-and-compliance.md`. During this transition,
keep the current single-operator's continuity in mind: the existing
operator becomes the first workspace's owner, per the migration section of
`.claude/docs/04-multi-tenancy-and-auth.md` — do not lock the current
operator out mid-migration."

**Why it matters here:** this is the single highest-leverage change in the
whole transformation — every other Phase-1-and-later feature (roles,
per-workspace credentials, quota tracking, CRM connectors) depends on
there being a real, specific signed-in identity instead of one shared
password.

---

## 2. Enforce the owner/member authorization model everywhere

**Prompt:**

"Per `.claude/docs/04-multi-tenancy-and-auth.md`, implement exactly two
roles for now: owner (full control, including provider credentials and
inviting/removing members) and member (can view/import/enrich leads,
generate outreach, but cannot change workspace-level provider credentials
or any billing-adjacent setting — even though there's no billing, this
boundary still matters because credentials like CRM/email API keys are
shared and sensitive within a workspace). Build a single, shared
authorization helper that resolves 'current user → current workspace →
role in that workspace' and require every API route and server action to
go through it before touching any workspace-scoped data — extend the
existing `requireRole` helper mentioned in
`.claude/docs/02-current-state-audit.md` rather than writing ad hoc
per-route checks. Audit every existing route and explicitly list which
ones are owner-only vs member-accessible before wiring the checks in, and
show me that list for confirmation before you finalize which routes get
which restriction."

**Why it matters here:** `.claude/docs/11-security-and-compliance.md`
treats data isolation and role boundaries as security requirements to be
tested adversarially, not just implemented — a single shared helper used
everywhere is what makes that kind of testing (see the end-to-end testing
pack) actually meaningful, instead of hoping every route remembered its
own check.

---

## 3. Move provider credentials from operator-global to workspace-scoped, encrypted

**Prompt:**

"Per `.claude/docs/04-multi-tenancy-and-auth.md` and
`.claude/docs/11-security-and-compliance.md`, move every provider
credential currently stored as an operator-global `.env` value or
single-operator setting (AI provider keys, contact-enrichment provider
key, SMTP/SendGrid/Gmail-app-password/Resend, Twilio SID/token,
the Google Sheets Apps Script URL) into per-workspace, encrypted storage.
Encrypt these at rest using a key managed outside the application database
(an environment-level secret used only to encrypt/decrypt), so a database
compromise alone doesn't expose every workspace's provider keys. Never
return a stored secret to the client in plaintext after its initial
entry — the settings GET endpoint should return either an `isSet`
boolean or a masked value (e.g., `sk-••••1234`), consistent with the
existing password-style input pattern already used in Settings. Keep a
sensible shared, budget-capped free-tier AI key as a fallback default for
workspaces that haven't configured their own (per
`.claude/docs/09-free-tier-and-fair-use.md`), but a workspace's own
credentials, once set, always take precedence and are fully isolated from
every other workspace's credentials and from the shared default."

**Why it matters here:** `.claude/docs/11-security-and-compliance.md`
calls workspace-provided credentials the single most sensitive data
category in the system — this prompt is what actually makes that true in
practice rather than just in a policy document.

---

## 4. Enforce data isolation at the query layer, not just the UI

**Prompt:**

"Audit every existing query against a workspace-scoped table (leads,
campaigns, settings, and anything else touched since Phase 0's schema
change) and confirm each one is filtered by the authenticated user's
active `workspaceId` at the data-access layer itself — not only hidden
from the UI, and not only checked in a route handler that a future
refactor could accidentally bypass. Where a query currently accepts a
resource ID from the client (e.g., a lead ID in a URL param), confirm the
query also requires that resource's `workspaceId` to match the session's
active workspace, so a guessable numeric ID from a different workspace
can never be returned. Treat this as a security requirement, per
`.claude/docs/11-security-and-compliance.md` — list any query you find
that doesn't yet do this, fix it, and flag it separately so we can add an
adversarial test for it later (see the end-to-end testing pack's
cross-workspace isolation prompt)."

---

## 5. Track fair-use quota counters, not yet enforced

**Prompt:**

"Per the migration roadmap's Phase 1 scope and
`.claude/docs/09-free-tier-and-fair-use.md`, add quota-counter tracking
(per workspace, per day) for leads ingested, enrichment-pipeline runs,
CRM export operations, outreach generations, and campaign sends — but do
not enforce any limit yet; this phase only starts gathering real usage
data ahead of strict enforcement in Phase 4. Expose these counters
somewhere an operator (you, during this transition) can inspect them, even
if there's no polished UI for it yet, so real usage patterns can inform
the actual numeric limits chosen later rather than guessing at launch."

**Why it matters here:** `.claude/docs/09-free-tier-and-fair-use.md` is
explicit that exact numeric limits should be tuned from real usage data,
not hard-coded once and forgotten — this only works if counting starts
well before enforcement does.

---

### How to use this pack

Run prompts 1 through 5 in order — each depends on the identity/session
model prompt 1 establishes. This is the phase where the current
single-operator deployment's login experience changes for the first time,
so plan the cutover communication (even if it's just yourself) around
prompt 1 specifically.
