# ADR-0001: Remove the Embedded CRM/Pipeline, Use External CRM Connectors

## Status

Accepted.

## Context

The current app includes a Kanban-style pipeline (stages, drag-and-drop,
notes, attachments, follow-ups, won/lost tracking) stored client-side in
IndexedDB. It only works for a single operator on a single browser/device,
which is fundamentally incompatible with a multi-tenant SaaS where a
workspace may have multiple members who need shared, durable visibility
into deal status. Rebuilding it as a proper multi-user, server-backed CRM
would mean competing with mature, purpose-built CRMs (HubSpot, Pipedrive,
Salesforce, etc.) on their own turf, which is a large, ongoing investment
unrelated to CreativeLead's actual value proposition: finding, enriching,
and scoring local-business leads.

## Decision

Remove the in-app Kanban pipeline/CRM entirely. CreativeLead keeps only a
minimal internal status field to track its own processing pipeline (new →
enriching → enriched → exported → failed). Deal-stage tracking, notes,
attachments, follow-ups, and won/lost tracking move to whichever external
CRM a workspace connects: HubSpot, Google Sheets, or a generic outbound
webhook for any other CRM/automation tool.

## Consequences

- Positive: CreativeLead's own scope shrinks to what it's actually good
  at, reducing long-term maintenance burden and multi-tenant complexity
  (no need to build multi-user real-time collaboration, permissions on
  deal notes, etc.).
- Positive: workspaces keep using whatever CRM they already have
  organizational buy-in for, rather than migrating deal history into a new
  tool.
- Negative: workspaces with no existing CRM lose the "everything in one
  place" convenience the current tool offers, at least until they connect
  Google Sheets (the lowest-friction fallback) or a webhook-based
  automation.
- Negative: this is a breaking change for the current single operator's
  workflow; migration must offer at least the Google Sheets connector
  before the pipeline UI is removed (see `10-migration-roadmap.md`,
  Phase 3), so there's no gap where leads have nowhere to land.

## Alternatives considered

- **Keep and properly rebuild the CRM as multi-user/server-backed.**
  Rejected: this turns CreativeLead into a CRM-building project, competing
  with established players, for a capability that isn't the product's
  differentiator, and it substantially increases the schema/security
  surface (deal permissions, activity feeds, etc.) that has to be
  multi-tenant-safe.
- **Keep the CRM as an optional feature alongside connectors.** Rejected
  for the initial transformation: maintaining both an internal CRM and
  external connectors doubles the surface area for a capability most
  workspaces will use externally anyway; can be revisited later with real
  usage data if there's strong demand for a lightweight internal tracker,
  but that would be a new ADR informed by that data.
