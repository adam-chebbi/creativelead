Review the change described by the user (a PR, a diff, or a proposed
design) against `.claude/docs/08-infrastructure-vps.md` and
`.claude/docs/09-free-tier-and-fair-use.md`. Specifically check and report
on:

1. Does any new code path perform slow or external I/O (AI provider calls,
   website fetching, enrichment provider calls, CRM/email/SMS calls)
   synchronously inside a web request, instead of via the job queue
   described in `.claude/docs/06-enrichment-pipeline.md` and
   `.claude/decisions/ADR-0003-queue-based-processing.md`? Flag any
   violation.
2. Does the change introduce a new external dependency (datastore, broker,
   SaaS) that isn't justified against the small-VPS budget? If so, note
   that it needs an ADR.
3. Is any new/changed query or table missing `workspace_id` scoping, per
   `.claude/docs/04-multi-tenancy-and-auth.md`?
4. Does the change add any per-workspace or per-provider unbounded loop or
   unthrottled call pattern that could starve other workspaces or exceed a
   free-tier provider's rate limit?
5. Does the change introduce anything payment/billing/plan-tier related?
   If so, flag it clearly — this project has an explicit no-payment-system
   decision (`.claude/decisions/ADR-0002-no-payment-system.md`).

Summarize findings as a short pass/fail checklist with specific file/line
references where possible, not a general essay.
