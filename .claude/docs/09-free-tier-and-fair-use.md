# 09 — Free to Use, No Payment System: Sustainability Model

## Decision

CreativeLead has no payment/subscription system: no plans, no prices, no
billing integration, no paywalled features. See
`ADR-0002-no-payment-system.md`. Sustainability instead comes from three
things working together: (1) preferring free-tier third-party providers,
(2) fair-use quotas enforced in-app, and (3) a small, predictable
infrastructure footprint (`08-infrastructure-vps.md`).

## Fair-use quotas, not paywalls

Quotas exist to protect shared infrastructure and shared free-tier
provider allowances from being exhausted by any single workspace — they
are a technical safeguard, not a monetization lever, and should be
communicated to users that way (a clear in-app message like "you've hit
today's extraction/enrichment limit — it resets tomorrow," never "upgrade
to unlock more").

Reasonable dimensions to cap, per workspace, per time window:

- **Leads ingested** (via extraction sync or import) per day.
- **Enrichment-pipeline runs** (AI scoring calls, contact-enrichment
  provider calls) per day — this is the main protection for shared
  free-tier AI/enrichment provider allowances.
- **CRM export operations** per day.
- **Outreach message generations** per day.
- **Campaign sends** (email/SMS/WhatsApp) per day, additionally bounded by
  whatever the workspace's own connected provider (their own SMTP/Twilio
  account, if configured) allows — a workspace using its *own* provider
  credentials can reasonably get a higher or separate quota than one
  relying on a shared default, since they're not consuming shared
  capacity.

Exact numeric limits are a product/ops decision to tune with real usage
data, not something to hard-code once and forget — but the *mechanism*
(soft daily/rolling quotas, workspace-scoped, silently protective rather
than punitive) is the architectural decision to build in from the start.

## Provider-cost strategy

- Default to free-tier AI models (as the current provider settings already
  do) for any workspace that hasn't configured its own key — this is what
  makes "free to use" actually free to operate, not just free to the
  workspace while CreativeLead absorbs paid API costs.
- Workspaces that configure their own AI/enrichment/CRM/email/SMS provider
  keys use their own allowances and are not subject to the *shared*
  default-provider quota for that specific capability (they still respect
  infrastructure-fairness limits like concurrency caps, since those
  protect the shared VPS itself, not a shared paid allowance).
- Never silently fall back to a paid default provider on a workspace's
  behalf — if free-tier capacity for the shared default is exhausted, the
  pipeline should queue/delay or clearly report the limit rather than
  incurring cost without consent.

## What this means for product surfaces

- No pricing page, no "plans" concept in the UI or data model.
- No feature gating by payment status anywhere in the codebase — if a
  quota is reached, the UI communicates a *temporary, resetting* limit,
  never a permanent restriction tied to identity or payment.
- Settings around provider credentials should make it easy and clearly
  beneficial for a workspace to bring its own keys (framed as "get higher
  limits by using your own API keys," which is honest and doesn't require
  a payment system to be true).

## Abuse prevention (distinct from fair-use quotas)

Fair-use quotas protect against *organic* over-use; a small amount of
additional protection against deliberate abuse (scripted mass sign-ups,
scraping the service itself) is worth having given there's no payment
barrier acting as a natural deterrent:

- Standard sign-up rate limiting and basic bot/abuse detection at the
  authentication layer.
- Per-IP and per-account creation-rate limits, sized loosely against the
  infrastructure budget in `08-infrastructure-vps.md`.
- Manual workspace suspension capability for the rare case abuse slips
  through automated protections — an operational escape hatch, not a
  feature to build UI around.
