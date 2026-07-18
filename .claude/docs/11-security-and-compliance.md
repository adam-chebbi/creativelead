# 11 — Security & Compliance Notes

## Data handled

- Publicly available business listing data (name, category, address,
  phone, rating, review text) extracted from Google Maps — low sensitivity,
  but still subject to the terms of service of the source and to
  applicable scraping/data-collection regulations in the operator's and
  leads' jurisdictions; this is a legal/ToS consideration for the product
  owner to track, not something this document resolves.
- Contact data returned by optional enrichment providers (emails, phone
  numbers, social profiles) — treat this as personal data requiring the
  same handling care as any contact database: workspace-isolated, not
  used for anything beyond the workspace's own outreach, deletable on
  request.
- Workspace-provided third-party credentials (AI, CRM, enrichment, email/
  SMS provider keys) — the most sensitive data category in the system;
  encrypted at rest, never returned to the client after entry, never
  logged, access-scoped to the worker processes that need them at the
  moment of use.

## Baseline security posture to preserve and extend

- Security response headers already present in `middleware.ts` (frame
  options, content-type sniffing protection, referrer policy, HSTS,
  removal of `X-Powered-By`) apply to every route, including all new
  auth, extension-sync, and CRM-connector endpoints.
- Rate limiting extends to authentication endpoints (sign-in requests),
  the extension sync/ingestion endpoint, and any public-facing API
  surface — not just the AI-provider calls it currently guards.
- All external outbound calls (AI providers, enrichment providers, CRM
  connectors, email/SMS providers, website probing) go through
  server-side code only; no provider credential is ever sent to or
  usable from the browser.

## Multi-tenant isolation as a security requirement

- Treat workspace data isolation (detailed in
  `04-multi-tenancy-and-auth.md`) as a security control, not just a
  correctness feature: it should be covered by tests that specifically try
  to access another workspace's data with a valid-but-wrong-workspace
  session, not only tested via the happy path.
- Encrypted credential storage keys should themselves be managed outside
  the application database (e.g., an environment-level secret used to
  encrypt/decrypt workspace credentials), so a database compromise alone
  does not expose every workspace's provider keys.

## Extension-specific considerations

- The extension only ever transmits data to the workspace's own
  CreativeLead backend, authenticated with a workspace-scoped token — it
  should never be given broader API credentials than "create leads in this
  one workspace."
- Extraction stays entirely client-side (as today); the extension does not
  become a general-purpose scraping proxy for the backend.

## Website-probing safety

- The enrichment pipeline's website probe fetches third-party sites on the
  workspace's behalf; this must be time-boxed, size-limited, and
  protected against fetching internal/private network addresses (no
  probing `localhost`, private IP ranges, or the app's own infrastructure)
  to prevent the probe from being used as a server-side-request-forgery
  vector.

## Compliance posture (lightweight, not a legal opinion)

- Provide a clear data-deletion path per workspace (delete workspace →
  delete its leads, settings, and credentials) since the product handles
  personal contact data without a formal data-processing agreement
  framework in place; this is the minimum reasonable baseline regardless
  of which specific regulatory regime ends up applying to a given
  workspace's usage.
- Keep a record (even a simple one) of which third-party providers a
  workspace has connected, since each is a data-sharing relationship a
  workspace owner should be able to see and revoke at any time from
  Settings.
- Nothing in this document constitutes legal advice; formal compliance
  requirements (GDPR, CCPA, or similar, depending on target markets)
  should be reviewed by the product owner before wide launch, informed by
  where actual users and their leads are located.
