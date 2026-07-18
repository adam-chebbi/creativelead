# 15 — End-to-End Testing: Every Actor Flow, Backend + Frontend, Run Against Production

This is the last pack to run, after the scaling, feature, OpenCode-workflow,
and extension packs have landed — it assumes the app already has the
actors, flows, and endpoints described in `.claude/docs/04-multi-tenancy-and-auth.md`,
`05-crm-integrations.md`, `06-enrichment-pipeline.md`, and
`07-browser-extension-roadmap.md`. Paste these prompts one at a time into
your coding agent. The project already has `playwright.config.ts` and a
passing `test-results/.last-run.json` — this pack extends that setup
rather than replacing it.

## Read this before Prompt 1: what "test in production with real
credentials" should actually mean

Testing against the live production environment is the right call for
catching what staging can't (real DNS/TLS, real provider rate limits, real
queue/worker behavior under the actual VPS budget). But "use true
credentials" needs one guardrail before any of this runs: tests should use
**real, working credentials for a dedicated, permanent QA workspace** —
not a real customer's workspace, and not real leads' contact
information as the send target. Running the outreach/campaign flows with
literal customer email/phone data would mean actually emailing or texting
real third parties as a side effect of a test run, and running enrichment
against real customer credentials risks burning through a paying (or
free-tier-quota-limited) workspace's own budget. Prompt 1 sets this up
before anything else touches production.

---

## 1. Establish a permanent QA workspace and safe-send guardrails

**Prompt:**

"Before writing any Playwright tests that run against production, set up
a permanent, always-on QA workspace inside the real production database —
not a mocked environment — with its own real, working provider credentials
for each integration category (a free-tier AI provider key, a test HubSpot
account or sandbox, a dedicated Google Sheet used only for QA, a Resend/
SMTP sending identity, and Twilio test credentials), so authentication and
provider-call code paths are genuinely exercised end-to-end rather than
stubbed. Store these QA credentials the same way any workspace's
credentials are stored (encrypted, workspace-scoped) — never in a
committed file — and expose them to the CI pipeline as encrypted secrets.
Every outbound send this workspace's tests trigger (email, SMS, WhatsApp,
CRM export) must be configured so its actual destination is a QA-owned
inbox/phone number/CRM sandbox that the team controls, never a real
customer's or a real extracted lead's contact information — confirm this
explicitly for each channel before Prompt 2 proceeds. Every lead, campaign,
and CRM record this workspace creates should be tagged (a
`source: 'qa-e2e'` marker or equivalent) so it can be found and purged
without touching any other workspace's data, and add a scheduled cleanup
job that purges QA workspace data older than a short retention window so
test runs don't accumulate unbounded rows in the production database."

**Why it matters here:** this is what makes "test in production with real
credentials" actually safe — the credentials are real and the code paths
are real, but the blast radius of a test run is fully contained to data
and destinations the team owns.

---

## 2. Map every actor and every flow before writing tests

**Prompt:**

"Before writing test code, produce a written inventory (no test code yet)
of every distinct actor and the flows each one can perform, based on
`.claude/docs/04-multi-tenancy-and-auth.md` and the current app: (a) an
unauthenticated visitor (sign-up, magic-link sign-in, invalid/expired
magic-link handling); (b) a workspace owner (full settings access,
inviting/removing members, connecting/disconnecting each CRM destination,
configuring each AI/enrichment/email/SMS provider, managing scoring
config); (c) a workspace member (everything an owner can do except
provider-credential and member-management screens, and confirm those are
actually blocked, not just hidden in the UI); (d) a user who belongs to
more than one workspace (switching workspaces, confirming data from one
workspace never leaks into the other's view); (e) the browser extension
acting as an authenticated client (sync-based lead ingestion, workspace
selection, the resume-after-interruption behavior, and the manual
JSON-export fallback path); (f) the background worker acting on ingested
data with no direct human actor (enrichment pipeline stage transitions,
CRM export retries/backoff, campaign sends) — these need to be verified
through their observable effects (lead status changes, CRM records
appearing, emails/messages arriving in the QA-controlled inbox/phone) since
there's no UI action to trigger them directly. For each actor, list the
flows as concrete scenarios (e.g., 'owner imports a lead list, waits for
auto-enrichment to complete, confirms it appears in the connected Google
Sheet with correct field mapping') rather than page names. Show me this
inventory before writing any Playwright code so we agree on coverage
first."

**Why it matters here:** writing tests page-by-page tends to miss the
things that actually break a SaaS app — role boundaries, cross-workspace
isolation, and asynchronous background effects — whereas starting from
actors and end-to-end scenarios surfaces exactly those.

---

## 3. Frontend flow coverage

**Prompt:**

"Using the actor/flow inventory from the previous step, write Playwright
tests (extending the existing `playwright.config.ts`) for every
human-actor flow, running against the production URL using the QA
workspace's real credentials via magic-link sign-in (automate retrieving
the magic-link token the same way a real user would receive it — through
the QA inbox this workspace already has configured — rather than bypassing
sign-in with a backdoor test-only auth route, since the sign-in flow
itself is part of what needs coverage). Cover: sign-up and sign-in
(including expired/invalid magic-link handling), workspace creation and
switching, member invite and role-boundary enforcement (a member account
attempting an owner-only action should be blocked, and a test should
assert that explicitly rather than only testing the owner's happy path),
every settings section save/reload round-trip (confirm secrets are
masked on reload, per the settings-persistence prompt from the feature
pack, not returned in plaintext), lead import and the resulting UI states
(loading/error/empty, per the health-prompts pack), the outreach message
generator for every channel, campaign creation, and every CRM connector's
'connect / test connection / disconnect' UI flow. Each test should clean
up after itself (disconnect what it connected, delete what it created) or
rely on the QA-workspace purge job from Prompt 1 — don't leave one test's
side effects able to break a later, unrelated test run."

---

## 4. Backend/API and asynchronous-pipeline coverage

**Prompt:**

"Add Playwright API-request tests (using Playwright's request context,
not just page automation) that exercise the backend directly: every
`/api/leads/*` route, the extension's ingestion endpoint (simulating the
extension's authenticated batch-sync payload shape), and every CRM-export
and settings route, asserting correct status codes, correct
workspace-scoping (a request authenticated as the QA workspace must never
be able to read or write another workspace's rows — test this adversarially
with a valid QA-workspace session attempting to fetch a different
workspace's known record ID, and assert it's rejected, not silently
returned empty), and correct rate-limiting behavior on the endpoints
`.claude/docs/11-security-and-compliance.md` calls out (auth endpoints,
ingestion endpoint). For the asynchronous enrichment pipeline
(`.claude/docs/06-enrichment-pipeline.md`), write tests that submit a lead
through the QA workspace, then poll (with a sensible timeout, not a fixed
sleep) for the lead's status to progress through
received → probing → enriching/skipped → scoring → enriched, and assert
the terminal state's data (score, classification, opportunity narrative)
is present and well-formed. Do the same for a deliberately induced failure
case (an invalid/unreachable configured provider) and assert the pipeline
reaches `failed` with a stored, human-readable reason rather than hanging
or silently dropping the lead."

**Why it matters here:** the enrichment pipeline and CRM export are
background-worker behavior with no page to click through — the only way
to actually verify ADR-0003's queue-based processing model works is to
assert on the state transitions and side effects it produces, not on any
UI.

---

## 5. Extension end-to-end coverage

**Prompt:**

"Add Playwright tests that load the packaged extension in a Chromium
context (Playwright supports loading unpacked extensions for testing) and
drive a real extraction session against a live Google Maps page using the
QA workspace's sync credentials: start extraction, confirm leads sync to
the QA workspace in small batches (not one request per lead), confirm the
resume-after-interruption behavior (close and reopen the tab mid-session,
confirm it picks back up rather than restarting), confirm the per-session
cap is enforced, and confirm the manual JSON-export fallback still
produces a valid file if sync is deliberately pointed at an unreachable
endpoint. If the in-page overlay from the extension-overlay pack has
landed, add tests that start/stop/monitor a session entirely from the
overlay and confirm the popup reflects the same session state, and vice
versa — this is the specific case where two UI surfaces controlling one
underlying session could silently drift apart, so it deserves direct
coverage rather than only testing each surface in isolation."

---

## 6. Wire it into CI, not just local runs

**Prompt:**

"Add a scheduled GitHub Actions workflow (separate from the existing
`.github/workflows/deploy.yml` build/deploy workflow, since this one
targets already-deployed production rather than a fresh build) that runs
this full Playwright suite against production on a regular schedule (for
example, after every deploy completes, plus a daily run to catch
environment drift that isn't tied to a code change) using the QA
workspace's credentials stored as encrypted GitHub secrets, uploads the
HTML report and trace files as build artifacts on failure, and — if a
deploy-triggered run fails — flags the deploy as needing attention
(a failing status check and a notification) rather than silently logging
a failure nobody sees. Keep the run's resource usage in mind per
`.claude/docs/08-infrastructure-vps.md`: the suite is a real user of the
production VPS's request-handling and worker capacity while it runs, so
schedule it at reasonable concurrency and off-peak-friendly timing rather
than hammering production with maximum test parallelism."

---

### How to use this pack

Run Prompt 1 once, before anything else — it's the guardrail that makes
every later prompt safe to run against real production. Run 2 and review
the inventory with the team before writing any test code. Run 3, 4, and 5
in any order once 1 and 2 are done; they cover independent surfaces. Run 6
last, once the suite itself is stable locally/on-demand, so you're not
scheduling a flaky suite to run unattended against production.
