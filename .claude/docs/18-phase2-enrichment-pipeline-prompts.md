# 18 — Migration Phase 2: Automatic Enrichment Pipeline

Turns `.claude/docs/06-enrichment-pipeline.md` and
`.claude/docs/10-migration-roadmap.md` (Phase 2) into ready-to-paste
OpenCode prompts. Assumes Phase 0's job queue and Phase 1's
workspace-scoped credentials already exist. No code included.

---

## 1. Build the explicit lead state machine

**Prompt:**

"Per `.claude/docs/06-enrichment-pipeline.md`, add an explicit,
persisted state field on the lead record representing its pipeline
progress through exactly these stages: `received` (raw lead written from
any ingestion path, enrichment job enqueued immediately), `probing`
(website reachability/SEO/performance probe — keep the existing probing
logic largely as-is, it already works and is described in
`.claude/docs/02-current-state-audit.md`), `enriching` (contact
enrichment via a configured provider — skip this stage without failing
the pipeline if the workspace hasn't configured one, since enrichment
providers are an enhancement, not a hard dependency, per the free-tier
model), `scoring` (existing rating/review/website-quality/opportunity-gap
scoring plus an AI-assisted classification pass using the workspace's
configured or default free-tier provider), `enriched` (terminal success,
triggers the CRM export job if any destination is connected — that's the
next pack), and `failed` (terminal failure after retries exhausted, with a
stored, human-readable reason such as rate-limited, invalid credentials,
or timeout, and a manual retry action). Persist every stage transition so
a partial failure is visible and resumable rather than silently lost —
if the worker process restarts mid-pipeline for a lead, it must resume
from its last completed stage, not restart from `received` and redo
already-finished work."

**Why it matters here:** the migration roadmap's whole Phase 2 goal is
turning enrichment from a manual, per-lead click into something that just
happens — a state machine that's resumable and visible is what lets that
be true reliably instead of leads silently getting stuck with no way to
tell why.

---

## 2. Trigger the pipeline automatically from every existing ingestion path

**Prompt:**

"Per `.claude/docs/03-target-architecture.md`'s ingestion flow, make sure
every current ingestion path (manual JSON/CSV import is the only one that
exists at this point in the migration, per Phase 2's scope in
`.claude/docs/10-migration-roadmap.md` — extension sync lands in Phase 4)
enqueues the enrichment job immediately after writing the raw lead, with
zero manual 'enrich' action required anywhere in the UI. Remove the
existing manual enrich-trigger button/action if one currently exists, or
repurpose it into a manual *retry* action usable only on leads in the
`failed` state, per the state machine from the previous prompt. Confirm
that importing a batch of leads (bulk import) enqueues one job per lead
rather than one job for the whole batch, so a single lead's slow provider
response doesn't hold up every other lead in the same import."

---

## 3. Centralize rate limiting, retry, and per-workspace fairness in the job system

**Prompt:**

"Per `.claude/docs/06-enrichment-pipeline.md` and
`ADR-0003-queue-based-processing.md`, move the existing ad hoc
provider-retry logic (the current Gemini 429 backoff pattern mentioned in
`.claude/docs/02-current-state-audit.md` is a good instinct applied only
to one provider) into a shared, centralized capability every provider
integration in the job system uses — every AI provider, every
contact-enrichment provider, and (once it lands in the next pack) every
CRM connector should get consistent rate-limit/backoff/retry behavior for
free, not reimplemented per integration. Add per-workspace concurrency
limits so one workspace's large bulk import cannot starve every other
workspace's jobs — implement this as a fair scheduling discipline (for
example, round-robin across workspaces, or a max-in-flight-jobs cap per
workspace) rather than optimizing purely for raw throughput. Spread
website probes and AI scoring calls for a bulk import over time rather
than firing them all concurrently, trading a small amount of added
latency for staying inside both the provider's rate limits and the VPS's
CPU/network budget from `.claude/docs/08-infrastructure-vps.md`. Under
sustained load, new jobs should simply wait longer in the queue rather
than the web process attempting to do the work synchronously or timing
out a user's request — confirm this backpressure behavior explicitly."

**Why it matters here:** this is what makes the free-tier-provider
strategy in `.claude/docs/09-free-tier-and-fair-use.md` actually
survivable at multi-tenant scale — without centralized fairness, one
workspace's bulk import could exhaust a shared free-tier AI allowance for
every other workspace on the same deployment.

---

## 4. Free-tier-first provider selection, with no silent cost surprises

**Prompt:**

"Per `.claude/docs/09-free-tier-and-fair-use.md`, confirm the scoring
stage defaults to a free-tier AI model for any workspace that hasn't
configured its own provider key, exactly as the current Settings UI
already prefers per `.claude/docs/02-current-state-audit.md` — this
default must now apply server-side, per-workspace, rather than being a
client-supplied choice per session. If the shared default provider's
free-tier capacity is exhausted, the pipeline should queue/delay the job
and clearly surface that state on the lead (per the `failed` state's
stored-reason requirement, or a distinct 'waiting on shared capacity'
sub-state if that's cleaner) rather than silently falling back to a paid
provider on the workspace's behalf — no cost should ever be incurred
without the workspace's explicit configuration having authorized it."

---

## 5. Lightweight observability for the pipeline

**Prompt:**

"Per the 'Observability' section of `.claude/docs/06-enrichment-pipeline.md`
and the 'Observability on a budget' section of
`.claude/docs/08-infrastructure-vps.md`, add structured logging for every
stage transition (workspace, lead, stage, duration, provider used) and a
small set of counters (jobs processed/failed per stage, queue depth,
per-provider error rates) sufficient to answer 'why is this lead stuck'
and 'which provider is timing out' without reproducing the issue. Do not
stand up a full metrics/tracing platform for this — structured logs plus
simple counters are the explicit target at this scale; a heavier
observability stack would itself compete for the VPS's limited
resources."

---

### How to use this pack

Run prompts 1 through 5 in order — the state machine in prompt 1 is the
foundation every later prompt in this pack (and the CRM-export pack that
follows) writes against.
