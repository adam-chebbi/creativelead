# 12 — Working on CreativeLead with the OpenCode Agent

This pack is for switching day-to-day development from an ad hoc "paste a prompt into any assistant" workflow to a repeatable one built around the open-source **OpenCode** agent, while keeping the `.claude/` folder as the single source of truth for product/architecture decisions. Paste each prompt below into OpenCode, in order, inside the `creativelead` project folder. No code is included here on purpose — this pack only configures
*how the agent reads the project*, not the project itself.

**Why this pack exists:** OpenCode does not read `.claude/docs/` or
`.claude/decisions/` automatically. Out of the box it only looks for an
`AGENTS.md` (or, if that's absent, a `CLAUDE.md`) at the project root, plus
whatever files are explicitly listed in an `instructions` array in
`opencode.json`. Without the prompts below, an OpenCode session would never
see the vision doc, the ADRs, the multi-tenancy plan, or the extension
roadmap, and would happily re-litigate decisions that are already settled
(re-adding a payment system, re-adding the embedded CRM, calling providers
synchronously inside a web request, etc.).

---

## 1. Point OpenCode at the existing `.claude/` project memory

**Prompt:**

"This repository already has a full project-memory folder at `.claude/` —
`.claude/CLAUDE.md` (entry point), `.claude/docs/01` through `11` (vision,
current-state audit, target architecture, multi-tenancy/auth, CRM
integrations, enrichment pipeline, extension roadmap, VPS infrastructure,
free-tier/fair-use model, migration roadmap, security/compliance), and
`.claude/decisions/` (ADRs). Do not duplicate or rewrite any of this
content into a new `AGENTS.md` from scratch. Instead, create (or update)
`opencode.json` at the project root so its `instructions` array explicitly
lists, in this order: `.claude/CLAUDE.md`, every file under `.claude/docs/`
in numeric order, and every file under `.claude/decisions/`. Then create a
short root-level `AGENTS.md` whose entire content is a pointer: it states
in a few lines that this project's real ground rules live in `.claude/`,
names the entry-point file, and instructs any agent session to read that
entry point (and the doc for whatever area is being touched) before making
any change, exactly as `.claude/CLAUDE.md` already asks of a human or
Claude Code session. Confirm back which files you added to the
`instructions` array and show me the final list before moving on."

**Why it matters here:** this makes `.claude/` the single source of truth
regardless of which agent (Claude Code, OpenCode, or a human) is doing the
work, instead of maintaining two parallel "memory" systems that drift apart
over time.

---

## 2. Mirror the existing slash-commands into OpenCode's command format

**Prompt:**

"This repository has two reusable prompt templates written for Claude
Code's custom-command format: `.claude/commands/add-crm-connector.md` and
`.claude/commands/scale-audit.md`. Create equivalent OpenCode custom
commands under `.opencode/command/` with the same file names and
functionally identical content — same numbered steps, same references to
the specific `.claude/docs/` and `.claude/decisions/` files, same
"don't start implementation until this checklist is agreed" framing. Do
not rewrite the underlying guidance; only adapt anything that is
syntactically specific to Claude Code's command format (for example,
argument-placeholder syntax) to OpenCode's `$NAME`-style placeholders where
a placeholder is actually useful (e.g., a `$CRM_NAME` placeholder for
`add-crm-connector`, a `$CHANGE_DESCRIPTION` placeholder for
`scale-audit`). List the two new files and their exact command names once
done."

**Why it matters here:** the two existing commands encode real process
(don't build a CRM connector without an ADR sign-off, don't approve a
scaling-risky change without checking it against the VPS/fair-use docs) —
recreating them as native OpenCode commands means `opencode run
scale-audit` works the same way `/scale-audit` already works today.

---

## 3. Session ground rules to paste at the start of every OpenCode session

**Prompt:**

"Before making any change in this repo this session: read `.claude/CLAUDE.md`
in full, then read whichever specific file(s) under `.claude/docs/` cover
the area I'm about to ask you to change, and check `.claude/decisions/` for
any ADR that already settled a question you're about to touch. Treat every
constraint in those files as binding, not advisory — specifically: no
built-in CRM/pipeline (ADR-0001), no payment or subscription system
(ADR-0002), all slow or external work (AI calls, enrichment provider
calls, website probing, CRM/email/SMS sends) goes through the background
job queue and never runs synchronously inside a web request (ADR-0003),
every new or changed table and query must be scoped by `workspace_id`, and
every new dependency must be justified against the small-VPS budget in
`.claude/docs/08-infrastructure-vps.md`. If a request I give you this
session conflicts with any of this, stop and tell me which document and
which rule it conflicts with before writing any code — don't silently
reinterpret my request to make it fit, and don't silently violate the
constraint either. If we agree to change one of these settled decisions,
write a new ADR under `.claude/decisions/` before touching code, following
the existing ADR format."

**Why it matters here:** this is the same "ground rules" role the earlier
health-prompts pack's Prompt 0 plays for performance/resource constraints —
this version makes the *product/architecture* constraints equally binding
for an agent session, not just the performance ones.

---

## 4. Keep `.claude/` itself current as the agent works

**Prompt:**

"As you complete each phase of work described in
`.claude/docs/10-migration-roadmap.md`, update that file's checklist so it
reflects what's actually shipped rather than what was originally planned,
and update `.claude/docs/02-current-state-audit.md`'s 'what can stay
as-is' list the same way — prune anything that's no longer true of the
codebase. If a change you made required a decision that isn't captured by
an existing ADR (a new CRM connector, a new provider, a change to the
free-tier model, a new paid dependency, a change to how the extension
authenticates or syncs), write the ADR under `.claude/decisions/` before
you consider the task finished, not as an afterthought. Tell me at the end
of the session which `.claude/` files you updated, if any, alongside the
usual code diff summary."

**Why it matters here:** a project-memory folder only stays useful if it's
treated as a living document the agent maintains, not a one-time snapshot
that silently goes stale the moment real development starts.

---

### How to use this pack

Run prompts 1 and 2 once, at the start of adopting OpenCode for this repo.
Paste prompt 3 at the start of every subsequent OpenCode session (or wire
it in as OpenCode's `--system` override / a default agent prompt, per
OpenCode's agent configuration, so it's automatic rather than something you
have to remember to paste). Paste prompt 4 at the end of any session that
touched product or architecture decisions, not routine bug fixes.
