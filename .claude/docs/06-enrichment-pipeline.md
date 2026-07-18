# 06 — Automatic Enrichment Pipeline

## Goal

Every lead is enriched and scored automatically the moment it enters the
system, from any ingestion path, with no manual "enrich" click. This
replaces today's model where enrichment is an optional, manually-triggered,
per-lead action.

## Pipeline stages

Each lead moves through a small, explicit state machine, persisted on the
lead record so partial failures are visible and resumable rather than
silently lost:

1. **`received`** — raw lead written from ingestion (extension sync,
   import, or future API), enrichment job enqueued immediately.
2. **`probing`** — website reachability/SEO/performance probe runs
   (existing logic, kept largely as-is); this is the cheapest, most
   universally-available signal and always runs first regardless of
   whether paid enrichment providers are configured.
3. **`enriching`** — if the workspace has a contact-enrichment provider
   configured (Hunter.io / Clearbit / Apollo.io), it's queried for missing
   email/phone/social data. If none is configured, this stage is skipped
   without failing the pipeline — enrichment providers are an enhancement,
   not a hard dependency, which matters for the "free to use" goal.
4. **`scoring`** — the existing scoring model runs (rating/review-count/
   website-quality/opportunity-gap logic), plus an AI-assisted pass using
   the workspace's configured AI provider (defaulting to a free-tier model
   if the workspace hasn't set one) for classification and
   opportunity-gap narrative.
5. **`enriched`** — terminal success state; triggers the CRM export job
   (see `05-crm-integrations.md`) if any destination is connected.
6. **`failed`** — terminal failure state after retries are exhausted, with
   a stored reason (rate-limited, invalid credentials, timeout, etc.) and
   a manual "retry" action.

## Resource-aware processing (small-VPS constraint)

- All of the above runs in the **worker process**, never inline in a web
  request — see `03-target-architecture.md` and `08-infrastructure-vps.md`.
- **Per-workspace concurrency limits** prevent one workspace's large bulk
  import from starving every other workspace's jobs — a small, fair queue
  discipline (e.g., round-robin across workspaces, or a max-in-flight-jobs
  cap per workspace) matters more here than raw throughput.
- **Per-provider rate limiting** is centralized in the job system instead
  of scattered retry/backoff logic inside individual utility functions
  (the current Gemini 429-retry pattern is a good instinct, applied
  ad hoc — it should become a shared capability every provider integration
  uses). This is what lets the app keep using free-tier AI/enrichment
  providers without constantly tripping their limits.
- **Batching** — website probes and AI scoring calls for a bulk import are
  spread over time rather than fired concurrently, trading a bit of
  latency for staying inside both the provider's rate limits and the
  VPS's CPU/network budget.
- **Backpressure, not failure, under load** — when queues are deep, new
  jobs simply wait longer rather than the web process trying to do the
  work synchronously or timing out user requests.

## Free-tier-first provider strategy

- Default AI provider selection continues to prefer free-tier/free models
  (as the current Settings UI already does), keeping the enrichment
  pipeline usable at zero cost for a workspace that configures nothing.
- Contact-enrichment providers (Hunter.io/Clearbit/Apollo.io) remain
  optional and workspace-supplied; when absent, the pipeline still
  produces a useful result from the free signals (website probe + rating/
  review data + AI classification) rather than blocking on a paid
  dependency.
- Every provider call this pipeline makes is subject to the fair-use
  quotas defined in `09-free-tier-and-fair-use.md`, so a shared default
  free-tier key can't be exhausted by a single high-volume workspace.

## Observability

- Each stage transition is logged with enough context (workspace, lead,
  stage, duration, provider used) to answer "why is this lead stuck" and
  "which provider is timing out" without needing to reproduce the issue —
  important on a small VPS where there's no large observability stack to
  lean on. Keep this lightweight (structured logs + simple counters), not
  a new heavyweight monitoring dependency.
