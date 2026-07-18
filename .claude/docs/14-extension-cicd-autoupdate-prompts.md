# 14 — Browser Extension: CI/CD & Auto-Update for Installed Users

## Read this before pasting any prompt

There's a hard technical constraint worth being upfront about, because it
changes what's actually achievable here: **Chrome and Edge only
auto-update an extension that was installed through one of two channels**
— (a) the Chrome Web Store / Edge Add-ons store, where the browser checks
the store on its own schedule and updates silently, or (b) an extension
force-installed via **enterprise policy** (an admin-managed
`ExtensionInstallForcelist`/`ExtensionSettings` policy pointing at a
self-hosted `update_url`), which only works on browsers under an
organization's device management — it does **not** work for an ordinary
person who used "Load unpacked" in Developer Mode. An unpacked/dev-mode
install has no update mechanism at all; the browser has no way to know a
new version exists.

`.claude/docs/07-browser-extension-roadmap.md` currently keeps "Load
unpacked" as the primary distribution path and treats store publishing as
a later follow-up. That's a reasonable place to start, but it means
**true, silent, no-action-required auto-update for every installed user
is only possible once the extension is distributed through a store (or,
for agency/enterprise operators specifically, through managed-Chrome
policy)**. This pack gives you both the store-based path (works for
everyone, including individual operators) and the enterprise-managed path
(useful if your actual users are agencies on company-managed devices), and
a fallback in-extension version-check for anyone still on manual
Load-unpacked installs, since that group can't be silently updated no
matter what CI/CD does.

Decide which of these fits your actual user base before running these
prompts — if you're not sure, run Prompt 1 first and answer its question,
then come back for the rest.

---

## 1. Decide the distribution model (answer before continuing)

**Prompt:**

"Before building any auto-update pipeline, tell me: are CreativeLead's
extension users individual operators using their own personal Chrome/Edge
profile (in which case store publishing is the only path to real
auto-update), or are they primarily agency/team users on
company-managed/enterprise Chrome (in which case a self-hosted update
manifest plus an `ExtensionInstallForcelist`/`ExtensionSettings` policy is
also viable, without waiting on store review)? Most SaaS extension
audiences are the former. Recommend one primary path based on my answer,
and note the other as a secondary option only if I actually have
enterprise/managed-device users. Do not proceed to build a self-hosted
`update_url` mechanism as the *only* update path if most users are on
unmanaged personal browsers — that would silently fail to update anyone
outside an IT-managed fleet."

---

## 2. Versioning & build pipeline (applies regardless of distribution model)

**Prompt:**

"Set up a CI workflow, alongside the existing `.github/workflows/deploy.yml`
pattern, that runs on every push to `main` touching `browserextractor/`:
it bumps the extension's manifest version following semantic versioning
(patch for fixes, minor for additive features, major for breaking sync
protocol changes — infer which from the PR/commit messages, or ask me to
confirm before tagging a minor/major bump), builds the packaged extension
artifact for both Chrome and Edge from the same source (they're the same
Manifest V3 codebase; only the packaging/publish step differs), runs the
existing extension test suite against the build, and produces a versioned,
immutable build artifact (uploaded the same way the current workflow
uploads the Next.js build artifact) before anything is published anywhere.
Nothing below should publish an artifact that hasn't passed this build
and test step."

---

## 3a. If store distribution is the answer — publish pipeline

**Prompt:**

"Extend the CI pipeline so that once a build artifact passes, a separate
job automatically submits it to the Chrome Web Store (via the Chrome Web
Store publish API, using a stored, encrypted developer/service-account
credential — never a personal Google login) and to Edge Add-ons (via its
equivalent publish API) whenever a version bump lands on `main`, gated
behind a manual approval step in the CI pipeline (a required reviewer
before the publish job runs) rather than fully automatic publish-on-merge,
since store review can reject or delay a release and you want a human
checkpoint before that's triggered. Store submission itself is
asynchronous and subject to each store's own review queue — the pipeline
should report the submission as 'submitted for review', not 'live', and
should not falsely claim every installed user is updated the moment CI
finishes; note that actual rollout to installed users happens on each
browser's own update-check schedule (typically within hours of the store
approving the new version, not instantly). This is the path that reaches
every ordinary installed user with zero action on their part, once the
review clears."

**Why it matters here:** this is the only mechanism that silently updates
individual, non-managed installs — it's the right default recommendation
for a public/self-serve SaaS extension, at the cost of a review-queue
delay outside your control.

---

## 3b. If enterprise/managed-device distribution is the answer — self-hosted update manifest

**Prompt:**

"Instead of (or in addition to) store publishing, extend CI so that a
passing build is packaged as a signed `.crx` and an update manifest XML
file, both published to versioned, stable URLs the pipeline controls (for
example, object storage or a static path served by the existing
infrastructure). The extension's own manifest should point its
`update_url` at that stable manifest URL. Clearly document, as part of
this same task, the admin-side steps a workspace's IT administrator needs
to take once (adding an `ExtensionInstallForcelist`/`ExtensionSettings`
policy entry pointing at the extension ID and that update manifest URL)
for their managed Chrome/Edge fleet to pick up updates automatically going
forward — this is inherently a per-organization, admin-managed setup, not
something CreativeLead can do on a user's behalf without them being on a
managed device. Do not present this as a way to update ordinary personal
installs; it only affects devices already under that organization's
Chrome/Edge management."

---

## 4. Fallback for anyone still on manual Load-unpacked installs

**Prompt:**

"For any user who installed the extension by loading it unpacked (which
cannot be silently auto-updated by either mechanism above), add a
lightweight, low-frequency version-check: the extension periodically asks
the workspace's backend (or a small static version-manifest endpoint,
whichever is cheaper to serve and matches the small-VPS budget in
`.claude/docs/08-infrastructure-vps.md`) for the current published
version, and if the installed version is behind, shows a small,
dismissible notice in the extension's popup and in the in-page overlay
(from the earlier overlay pack, if that's landed) with a direct link to
download the latest unpacked build or, once available, to the store
listing. This does not auto-update anything — it only removes the 'how do
I know I'm out of date' problem for users who are on a distribution path
that structurally can't be pushed to."

---

## 5. Rollback safety

**Prompt:**

"Whatever publish path we use, keep the previous N versioned build
artifacts (and, if self-hosted, the previous update-manifest revisions)
retrievable, and add a documented manual rollback step in CI (re-point the
current 'latest' pointer/store listing at a prior passing artifact) in
case a published version breaks sync or extraction for a meaningful share
of users. Do not delete old artifacts automatically until a newer version
has been live and error-rate-monitored for a reasonable window."

---

### How to use this pack

Run Prompt 1 first and act on its answer — it decides whether you need
3a, 3b, or both. Run Prompt 2 regardless. Run 3a and/or 3b based on your
Prompt-1 answer. Run 4 either way, since some fraction of users will
likely always be on a manual install even after store publishing exists.
Run 5 once the rest is in place.
