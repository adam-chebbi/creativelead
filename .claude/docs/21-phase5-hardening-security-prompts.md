# 21 — Migration Phase 5: Hardening, Load Testing & Security Review

Turns `.claude/docs/10-migration-roadmap.md` (Phase 5) and
`.claude/docs/11-security-and-compliance.md` into ready-to-paste OpenCode
prompts. This is the last phase in the migration roadmap and assumes
Phases 0–4 are live: multi-tenancy, the enrichment pipeline, all three CRM
connectors, and authenticated extension sync with fair-use enforcement.
No code included. Pair this pack with
`15-production-e2e-testing-prompts.md` — that pack's Playwright suite is
the tool you'll use to actually exercise the scenarios described here.

---

## 1. Load-test the full pipeline at representative multi-workspace volume

**Prompt:**

"Per `.claude/docs/10-migration-roadmap.md`'s Phase 5 scope, load-test the
complete pipeline — ingestion (both manual import and extension sync) →
enrichment → CRM export — at a representative multi-workspace volume
against the small-VPS budget defined in
`.claude/docs/08-infrastructure-vps.md`. Simulate several concurrent
workspaces each running realistic bulk imports and extraction sessions at
once, not just one workspace at a time, since the fairness mechanisms
from Phase 2 and Phase 4 (per-workspace concurrency caps, round-robin job
scheduling) are specifically meant to be tested under contention, not in
isolation. Report queue depth over time, per-stage job latency, worker
CPU/RAM under this load, and whether any workspace's jobs were
meaningfully starved by another's — then tune the concurrency limits and
fair-use quotas based on this real headroom data rather than the
placeholder assumptions used at launch."

**Why it matters here:** every earlier phase built the *mechanisms* for
fairness and resource limits; this is the first point in the migration
where those mechanisms get validated against real contention instead of
single-workspace testing, which is the only way to catch whether they
actually hold up.

---

## 2. Fill observability gaps found during load testing

**Prompt:**

"Based on what the load test in the previous prompt surfaced, fill any
observability gaps per the 'Observability on a budget' section of
`.claude/docs/08-infrastructure-vps.md`: add any missing structured log
fields or counters needed to answer questions the load test raised (for
example, if it was hard to tell which workspace was causing queue
backpressure, add a per-workspace queue-depth counter). Keep this
lightweight — structured logs and simple counters, not a new
metrics/tracing platform — and add simple threshold-based alerting
(queue depth too high, disk usage too high, worker process not consuming
jobs) rather than standing up a dedicated alerting product, consistent
with the small-VPS observability posture already defined."

---

## 3. Adversarial security review of workspace data isolation

**Prompt:**

"Per `.claude/docs/11-security-and-compliance.md`, run an adversarial
review of workspace data isolation — not the happy path. For every
API route and server action that touches workspace-scoped data (leads,
campaigns, settings, credentials, CRM export mappings), attempt to access
another workspace's data using a valid session for a *different*
workspace: pass another workspace's known resource IDs, try switching the
active-workspace context mid-request, and try any endpoint that accepts
an ID from the client without also checking it belongs to the session's
active workspace. Report every route where this succeeds (a real
finding, to be fixed immediately, not just logged) versus every route
where it was correctly rejected. Also confirm: provider credentials are
encrypted at rest and never returned to the client in plaintext after
initial entry; encryption keys are managed outside the application
database; rate limiting covers authentication endpoints and the
extension ingestion endpoint specifically, not only general API traffic;
and the website-probing step of the enrichment pipeline cannot be used to
fetch `localhost`, private IP ranges, or the app's own infrastructure
(guarding against it being usable as a server-side-request-forgery
vector)."

**Why it matters here:** `.claude/docs/11-security-and-compliance.md` is
explicit that isolation should be 'tested by specifically trying to
access another workspace's data with a valid-but-wrong-workspace session,'
not only verified by normal feature testing — this prompt is that test,
run as an explicit security exercise rather than folded quietly into
regular QA.

---

## 4. Confirm the compliance baseline is real, not just documented

**Prompt:**

"Per the 'Compliance posture' section of
`.claude/docs/11-security-and-compliance.md`, confirm (and build if
missing) a real data-deletion path per workspace: deleting a workspace
must delete its leads, settings, and credentials, not leave orphaned rows
scoped to a workspace ID that no longer has an owner. Confirm a workspace
owner can see, at minimum in a simple list, which third-party providers
(CRM, AI, enrichment, email/SMS) their workspace has connected, and can
revoke any of them from Settings at any time. This document is explicit
that it is not a legal opinion — do not claim this satisfies GDPR/CCPA/
any specific regulatory regime; only confirm the specific technical
behaviors listed above actually work as described."

---

## 5. Extension store submission, as a parallel, non-blocking track

**Prompt:**

"Per the migration roadmap, treat Chrome Web Store / Edge Add-ons
submission as a separate, lower-risk track that can run in parallel with
the rest of Phase 5 rather than blocking it. Before submitting, review
the extension's requested permissions and confirm each one is
justifiable in the store listing's permissions-justification section
(especially anything beyond `google.com/maps` host access and the
workspace-sync network call), and prepare the privacy-disclosure content
each store requires, describing what the extension collects (extracted
public business/review data) and what it sends and to where (only the
authenticated workspace's own CreativeLead backend, per
`.claude/docs/11-security-and-compliance.md`'s extension-specific
security notes). If you're also running the CI/CD auto-update pack
(`14-extension-cicd-autoupdate-prompts.md`), this is the point where that
pack's store-publishing path (3a) becomes relevant, rather than earlier
in the migration."

---

### How to use this pack

Run prompts 1 and 2 together (load test, then fix what it surfaces). Run
prompt 3 as its own dedicated security-focused session — don't fold it
into routine feature testing, since the point is adversarial thinking, not
happy-path confirmation. Run prompt 4 once, as a checklist. Run prompt 5
whenever it's convenient; it doesn't block anything else in this pack.
