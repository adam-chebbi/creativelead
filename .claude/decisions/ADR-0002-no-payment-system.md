# ADR-0002: No Payment/Subscription System — Free Use with Fair-Use Quotas

## Status

Accepted.

## Context

The product requirement is explicit: CreativeLead should be usable for
free, with no subscription/payment system. At the same time, it depends on
external providers (AI, enrichment, CRM, email/SMS) that have real usage
limits or costs, and runs on a small VPS with finite capacity. Without some
control mechanism, either a shared free-tier provider allowance gets
exhausted by a small number of heavy users, or the VPS gets overwhelmed by
unbounded background work.

## Decision

Build no billing, plans, or payment integration anywhere in the product.
Instead, enforce **fair-use quotas** (per workspace, per time window,
across ingestion volume, enrichment runs, CRM exports, outreach
generations, and campaign sends) purely as a technical safeguard for
shared infrastructure and shared free-tier provider allowances — never as
a monetization mechanism. Workspaces that bring their own provider
credentials get quota relief for that specific capability, since they're
no longer consuming shared allowance for it. See
`09-free-tier-and-fair-use.md` for the full model.

## Consequences

- Positive: the product stays genuinely free and simple to operate — no
  payment-provider integration, no invoicing, no plan-tier logic
  scattered through the codebase, no PCI-adjacent compliance surface.
- Positive: fair-use quotas double as an infrastructure protection
  mechanism, which the product needs anyway given the small-VPS
  constraint — the same mechanism solves both problems.
- Negative: without payment as a natural scaling lever, growth in usage
  translates directly into either infrastructure cost or quota tightening;
  this must be actively monitored (see `08-infrastructure-vps.md`,
  "When the VPS is not enough") rather than assumed to self-solve.
- Negative: no revenue mechanism means the project's ongoing viability
  depends on keeping infrastructure and provider costs low by design
  (free-tier-first providers, small-VPS-first architecture) — this
  constraint should stay visible in every future architectural decision,
  not just at launch.

## Alternatives considered

- **Freemium with a paid tier for higher limits.** Rejected per explicit
  product requirement — the product must stay free with no subscription
  system, full stop.
- **Donation/sponsorship model with no enforced quotas at all.** Rejected:
  without any quota mechanism, a single heavy workspace can exhaust shared
  free-tier provider allowances or overwhelm the VPS, degrading the
  experience for every other workspace — quotas are needed regardless of
  monetization strategy.
- **Hard, low, one-size-fits-all limits with no way to increase them.**
  Rejected in favor of the "bring your own provider keys for quota relief"
  model, which gives workspaces a real lever to scale their own usage
  without requiring CreativeLead to introduce payment.
