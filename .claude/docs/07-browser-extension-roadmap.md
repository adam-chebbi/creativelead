# 07 — Browser Extension: Scaling Plan

## What works today and should be preserved

- Fully client-side extraction from Google Maps — no server dependency to
  *scrape*, which is fast, resilient, and avoids putting scraping
  infrastructure/IP reputation risk on the VPS.
- Resume-from-where-you-left-off session handling.
- EN + FR locale support.
- A sensible per-session cap (currently ~100 leads) that protects both the
  user's browser tab and Google Maps from being hammered.

## What has to change

### From manual export/import to authenticated sync

Today the extension writes a local JSON file the operator manually
uploads. For "auto-enrichment on import or add" to be true for extension
users too, the extension needs to:

- Authenticate to a CreativeLead workspace (a signed-in session or a
  workspace-scoped access token generated from the web app, entered once
  in the extension's settings — no separate password system to build).
- Sync extracted leads directly to the workspace's ingestion endpoint as
  they're extracted (or in small batches), instead of requiring a manual
  file round-trip. Each synced lead immediately enters the automatic
  enrichment pipeline (`06-enrichment-pipeline.md`).
- **Keep manual JSON export available** as a fallback/offline mode — useful
  for operators who want an air-gapped extraction, or when the sync
  endpoint is unreachable — but make direct sync the default, recommended
  path.

### Resilience for a small-VPS backend

- Sync requests are small and batched (not one request per lead), and the
  extension backs off and retries locally if the ingestion endpoint is
  rate-limited or briefly unavailable, rather than losing data — the local
  JSON export/local storage buffer becomes the extension's *safety net*,
  not its primary storage.
- The extension should respect a server-communicated batch size / rate
  limit rather than a hardcoded one, so backend capacity can be tuned
  without shipping a new extension version.

### Multi-workspace support

- An operator who manages multiple client workspaces (an agency use case)
  needs to pick which workspace a sync goes to, mirroring the web app's
  workspace-switching model in `04-multi-tenancy-and-auth.md`.

### Packaging and distribution

- Keep the current "download the unpacked extension, Load Unpacked in
  Developer Mode" path working for now (zero cost, zero review process),
  but track Chrome Web Store / Edge Add-ons publishing as a follow-up once
  the sync-based extension is stable — store distribution improves trust
  and install friction for non-technical operators, at the cost of a
  review process and a small ongoing compliance burden (privacy
  disclosures, permissions justification) that should be scoped
  separately once the sync model above is finalized.

## Explicitly not changing

- The extraction logic itself (how it reads Google Maps' DOM/data) is
  extraction-technique detail that lives in the extension codebase, not in
  this planning document, and isn't part of the SaaS transformation scope.
- The extension does not become responsible for enrichment, scoring, or
  CRM export — those stay entirely server-side so they benefit from the
  shared queue, rate limiting, and quota system regardless of which
  ingestion path a lead came through.
