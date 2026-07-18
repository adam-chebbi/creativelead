The user wants to plan a new CRM/destination connector (beyond HubSpot,
Google Sheets, and the generic webhook already covered in
`.claude/docs/05-crm-integrations.md`).

Before writing any implementation code:

1. Confirm the connector fits the existing delivery-guarantee model
   (queued, retried with backoff, idempotent per lead+destination) from
   `.claude/docs/05-crm-integrations.md` — don't design a bespoke delivery
   mechanism per connector.
2. Confirm credential storage follows the workspace-scoped, encrypted
   settings model in `.claude/docs/04-multi-tenancy-and-auth.md` — no new
   global/operator-level credential storage.
3. Identify the field mapping from a CreativeLead enriched-lead payload
   (score, classification, opportunity gaps, website-quality signals,
   contact info, source) to the destination system's native object model.
4. Identify what happens when the destination is rate-limited or
   temporarily unavailable, matching the existing retry/backoff and
   `failed`-state behavior already defined for other connectors.
5. Note any new paid dependency this introduces (e.g., needing a paid tier
   of the destination CRM's API) and flag that it needs sign-off against
   `.claude/decisions/ADR-0002-no-payment-system.md`'s spirit — CreativeLead
   itself must not require paying for a destination on the workspace's
   behalf.
6. Draft a short ADR under `.claude/decisions/` before implementation
   begins, following the format of the existing ADRs.

Only after the above is agreed should implementation planning move to
actual code changes.
