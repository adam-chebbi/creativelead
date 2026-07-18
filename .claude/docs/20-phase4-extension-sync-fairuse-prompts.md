# 20 — Migration Phase 4: Extension Sync & Fair-Use Enforcement

Turns `.claude/docs/07-browser-extension-roadmap.md`,
`.claude/docs/09-free-tier-and-fair-use.md`, and
`.claude/docs/10-migration-roadmap.md` (Phase 4) into ready-to-paste
OpenCode prompts. Assumes Phases 0–3 have landed — real multi-tenant
auth, the enrichment pipeline, and at least one CRM connector already
exist. This pack covers the extension's *sync/auth* behavior specifically;
if you also want the in-page Google Maps overlay or the CI/CD
auto-update pipeline, those are separate packs
(`13-extension-maps-inline-overlay-prompts.md` and
`14-extension-cicd-autoupdate-prompts.md`) that build on top of what's
done here. No code included.

---

## 1. What to preserve from the current extension

**Prompt:**

"Before changing anything about how the extension gets data to the
server, confirm you are preserving every one of these existing behaviors
exactly, per `.claude/docs/07-browser-extension-roadmap.md`: fully
client-side extraction from Google Maps (no server dependency to scrape),
resume-from-where-you-left-off session handling, EN + FR locale support,
and the per-session lead cap (~100) that protects both the user's browser
tab and Google Maps itself from being hammered. This pack changes how
extracted leads get to CreativeLead, not how they're extracted — the DOM/
data-reading extraction technique itself is out of scope here."

---

## 2. Authenticate the extension to a workspace

**Prompt:**

"Add a way for the extension to authenticate to a specific CreativeLead
workspace: either a signed-in session shared with the web app, or a
workspace-scoped access token generated from the web app's settings and
entered once into the extension — no separate password system. This
token must only ever authorize 'create leads in this one workspace,' per
`.claude/docs/11-security-and-compliance.md`'s extension-specific
security notes — never a broader credential that could read other data
or act on the workspace's behalf beyond lead creation. An operator who
manages multiple client workspaces (the agency use case) needs to pick
which workspace a given extraction session syncs to, mirroring the web
app's workspace-switching model from `.claude/docs/04-multi-tenancy-and-auth.md`."

---

## 3. Sync extracted leads directly, replacing manual-export-as-the-default

**Prompt:**

"Change the extension's default behavior from writing a local JSON file
for manual upload to syncing extracted leads directly to the
authenticated workspace's ingestion endpoint as they're extracted, or in
small batches — never one request per lead. Each synced lead must
immediately enter the automatic enrichment pipeline from Phase 2, exactly
as a manually imported lead does, with no special-casing. Keep manual
JSON export fully available as an explicit fallback/offline mode — useful
for an air-gapped extraction, or when the sync endpoint is unreachable —
but make direct sync the default, recommended path in the UI. The
extension should back off and retry locally if the ingestion endpoint is
rate-limited or briefly unavailable, using its local storage buffer as a
safety net rather than its primary storage, and should respect a
server-communicated batch size / rate limit rather than a hardcoded one,
so backend capacity can be tuned later without shipping a new extension
version."

**Why it matters here:** this single change is what makes 'auto-enrichment
on ingestion' true for extension users too, closing the gap
`.claude/docs/02-current-state-audit.md` calls out — today nothing
happens until a human manually uploads a file."

---

## 4. Build the ingestion endpoint to handle batched, rate-aware sync

**Prompt:**

"On the server side, build (or extend, if manual import already has
something close) the ingestion endpoint the extension syncs to, per
`.claude/docs/07-browser-extension-roadmap.md`'s resilience requirements:
it must accept small batches (not single-lead requests), enforce the
workspace-scoped-token authorization from prompt 2, communicate a batch
size / rate limit back to the extension so the client can adapt without a
new release, and enqueue one enrichment job per lead exactly as the
manual-import path does from Phase 2 — the ingestion endpoint itself must
not do any slow work inline, per `ADR-0003-queue-based-processing.md`.
Apply the same rate-limiting requirement `.claude/docs/11-security-and-compliance.md`
calls out for the ingestion endpoint specifically, not just the general
API surface."

---

## 5. Turn on strict fair-use quota enforcement

**Prompt:**

"Per `.claude/docs/09-free-tier-and-fair-use.md` and using the quota
counters that have been tracked (but not enforced) since Phase 1, turn on
strict enforcement now, informed by the real usage data gathered so far —
not guessed numbers. Enforce per-workspace, per-day limits on leads
ingested, enrichment-pipeline runs, CRM export operations, outreach
generations, and campaign sends. When a workspace hits a limit, the
in-app message must be clear and non-punitive ('you've hit today's
extraction/enrichment limit — it resets tomorrow'), never framed as an
upsell or a permanent restriction — there is no plan to upgrade to, by
design. Confirm that a workspace using its own provider credentials (its
own AI key, its own SMTP/Twilio account) gets quota relief on the *shared
default provider's* quota for that specific capability, since it's no
longer consuming shared allowance — while still respecting
infrastructure-fairness limits like concurrency caps, which protect the
shared VPS itself regardless of whose credentials are being used. Never
have the pipeline silently fall back to a paid default provider on a
workspace's behalf if shared free-tier capacity is exhausted — queue,
delay, or clearly report the limit instead."

**Why it matters here:** the migration roadmap deliberately sequences
quota *tracking* (Phase 1) well before quota *enforcement* (Phase 4) so
the actual limits chosen here reflect real multi-tenant, multi-path
(import + extension sync) usage rather than a launch-day guess.

---

### How to use this pack

Run prompts 1 through 4 in order — they're one coherent feature (extension
sync). Run prompt 5 once sync has been live long enough to meaningfully
add to the usage data already gathered since Phase 1; enforcing quotas
before extension sync exists would tune limits against incomplete data.
