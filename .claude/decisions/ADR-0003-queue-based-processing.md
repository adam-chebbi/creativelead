# ADR-0003: All Slow/External Work Runs Through a Background Job Queue

## Status

Accepted.

## Context

The current app performs website probing, AI scoring, and outreach
generation largely inline within API route handlers, with ad hoc
retry/backoff logic for provider rate limits (e.g., the existing Gemini
429 handling) implemented separately per utility function. This works for
a single operator making occasional requests, but breaks down for a
multi-tenant SaaS on a small VPS: slow third-party calls (website fetches,
AI providers, enrichment providers) would tie up the request-serving
process, there's no shared mechanism for fairness across workspaces, and
duplicated retry logic is hard to reason about and extend consistently.

## Decision

Introduce a dedicated worker process and job queue (sized appropriately
for a small VPS — see `08-infrastructure-vps.md`). Every operation that
calls an external provider, scrapes a website, or otherwise isn't
guaranteed to complete quickly (enrichment pipeline stages, CRM exports,
outreach generation, campaign sends) becomes a queued job rather than
inline request-handler logic. Rate limiting, retry/backoff, and
per-workspace concurrency fairness live centrally in this job system, not
scattered per feature.

## Consequences

- Positive: the web process stays fast and stateless regardless of
  background load, which is important on limited VPS resources.
- Positive: centralizing rate-limit/retry/fairness logic means new
  provider integrations (a new CRM connector, a new AI provider) get this
  behavior for free instead of reimplementing it.
- Positive: jobs are naturally resumable/idempotent by construction, which
  matters for a small VPS that may restart processes more often than a
  larger, more redundant deployment would.
- Negative: introduces a new architectural component (queue + worker
  process) and a small amount of eventual consistency (a lead isn't
  enriched the instant it's created, but shortly after) — acceptable
  given the pipeline is inherently multi-step regardless of synchronous
  vs. queued execution.
- Negative: requires discipline going forward — any new feature that calls
  an external provider must be built as a job, not as a convenient inline
  call in a route handler, even when it would "probably be fast enough."

## Alternatives considered

- **Keep inline processing, add better retry logic per function.**
  Rejected: doesn't solve the fairness-across-workspaces problem or the
  request-blocking problem, and keeps retry/rate-limit logic duplicated
  and inconsistent across features.
- **Use a managed, paid queueing SaaS.** Rejected given the "prefer free/
  self-hostable tools, small-VPS budget" constraint; a lightweight,
  self-hosted queue (Postgres-backed or a small broker) is sufficient at
  target scale and keeps the stack within the documented infrastructure
  budget.
